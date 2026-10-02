import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activatePendingSession, getPendingTotpSession } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { normalizeRecoveryCode, verifyTotp } from "@/lib/totp";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";

const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 15 * 60 * 1000;

// 로그인 2단계: 대기 세션 + 인증 앱 6자리 코드(또는 복구 코드) → 정식 세션
export async function POST(req: NextRequest) {
  const { ip, userAgent } = getRequestMeta(req);
  const pending = await getPendingTotpSession();
  if (!pending)
    return NextResponse.json(
      {
        error: "인증 대기 시간이 지났습니다. 처음부터 다시 로그인해주세요.",
        expired: true,
      },
      { status: 401 },
    );
  const user = pending.user;
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = String(body.code ?? "").trim();
  if (!code)
    return NextResponse.json(
      { error: "코드를 입력해주세요." },
      { status: 400 },
    );

  const fails = await prisma.auditLog.count({
    where: {
      action: AuditAction.TOTP_FAIL,
      actorEmployeeId: user.employeeId,
      createdAt: { gte: new Date(Date.now() - FAIL_WINDOW_MS) },
    },
  });
  if (fails >= MAX_FAILS) {
    await prisma.session
      .delete({ where: { id: pending.id } })
      .catch(() => undefined);
    return NextResponse.json(
      {
        error:
          "코드 오류가 너무 많습니다. 15분 후 처음부터 다시 로그인해주세요.",
        expired: true,
      },
      { status: 429 },
    );
  }

  let ok = false;
  let usedRecovery = false;
  if (user.totpSecret && verifyTotp(user.totpSecret, code)) ok = true;
  else if (code.length >= 8) {
    // 복구 코드: 해시 대조 후 1회용으로 소진
    const norm = normalizeRecoveryCode(code);
    for (const h of user.totpRecoveryHashes) {
      if (await verifyPassword(norm, h)) {
        ok = true;
        usedRecovery = true;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            totpRecoveryHashes: user.totpRecoveryHashes.filter((x) => x !== h),
          },
        });
        break;
      }
    }
  }

  if (!ok) {
    void logAudit({
      action: AuditAction.TOTP_FAIL,
      actorUserId: user.id,
      actorEmployeeId: user.employeeId,
      ip,
      userAgent,
    });
    return NextResponse.json(
      { error: "코드가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  await activatePendingSession(pending.id);
  void logAudit({
    action: AuditAction.TOTP_SUCCESS,
    actorUserId: user.id,
    actorEmployeeId: user.employeeId,
    detail: usedRecovery ? "복구 코드 사용" : undefined,
    ip,
    userAgent,
  });
  void logAudit({
    action: AuditAction.LOGIN_SUCCESS,
    actorUserId: user.id,
    actorEmployeeId: user.employeeId,
    detail: "2단계 인증 통과",
    ip,
    userAgent,
  });
  return NextResponse.json({
    ok: true,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    usedRecovery,
    recoveryLeft: usedRecovery ? user.totpRecoveryHashes.length - 1 : undefined,
  });
}
