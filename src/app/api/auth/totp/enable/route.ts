import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentSessionToken, getCurrentUser } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import {
  generateRecoveryCodes,
  normalizeRecoveryCode,
  verifyTotp,
} from "@/lib/totp";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";

// 설정 확정: 인증 앱 코드가 임시 키와 맞으면 활성화 + 복구 코드 발급(한 번만 보여줌)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  if (!user.totpPendingSecret)
    return NextResponse.json(
      { error: "설정을 먼저 시작해주세요(QR 생성)." },
      { status: 400 },
    );
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = String(body.code ?? "").trim();
  if (!verifyTotp(user.totpPendingSecret, code))
    return NextResponse.json(
      {
        error: "코드가 맞지 않습니다. 인증 앱의 현재 코드를 다시 입력해주세요.",
      },
      { status: 400 },
    );

  const codes = generateRecoveryCodes();
  const hashes = await Promise.all(
    codes.map((c) => hashPassword(normalizeRecoveryCode(c))),
  );
  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpSecret: user.totpPendingSecret,
      totpPendingSecret: null,
      totpEnabledAt: new Date(),
      totpRecoveryHashes: hashes,
    },
  });
  // 다른 기기의 세션은 끊음(이 세션만 유지)
  const mine = await currentSessionToken();
  await prisma.session.deleteMany({
    where: { userId: user.id, ...(mine ? { id: { not: mine } } : {}) },
  });
  const { ip, userAgent } = getRequestMeta(req);
  void logAudit({
    action: AuditAction.TOTP_ENABLED,
    actorUserId: user.id,
    actorEmployeeId: user.employeeId,
    ip,
    userAgent,
  });
  return NextResponse.json({ ok: true, recoveryCodes: codes });
}
