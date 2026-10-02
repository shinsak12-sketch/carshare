import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { verifyTotp } from "@/lib/totp";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";

// 본인 해제: 비밀번호 + 현재 코드 둘 다 맞아야 함. 관리자는 계정 관리에서 reset_totp
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  if (!user.totpSecret)
    return NextResponse.json(
      { error: "2단계 인증이 켜져 있지 않습니다." },
      { status: 400 },
    );
  const body = (await req.json().catch(() => ({}))) as {
    password?: string;
    code?: string;
  };
  const okPw = await verifyPassword(
    String(body.password ?? ""),
    user.passwordHash,
  );
  const okCode = verifyTotp(user.totpSecret, String(body.code ?? "").trim());
  if (!okPw || !okCode)
    return NextResponse.json(
      { error: "비밀번호 또는 코드가 올바르지 않습니다." },
      { status: 401 },
    );
  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpSecret: null,
      totpPendingSecret: null,
      totpEnabledAt: null,
      totpRecoveryHashes: [],
    },
  });
  const { ip, userAgent } = getRequestMeta(req);
  void logAudit({
    action: AuditAction.TOTP_DISABLED,
    actorUserId: user.id,
    actorEmployeeId: user.employeeId,
    ip,
    userAgent,
  });
  return NextResponse.json({ ok: true });
}
