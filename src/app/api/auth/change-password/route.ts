import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentSessionToken, getCurrentUser } from "@/lib/session";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/password";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";

// 본인 비밀번호 변경(자발적·강제 공용). 현재 비밀번호 확인 → 규칙 검사 → 다른 세션 모두 종료
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
    confirm?: string;
  };
  const current = String(body.currentPassword ?? "");
  const next = String(body.newPassword ?? "");
  if (!(await verifyPassword(current, user.passwordHash)))
    return NextResponse.json(
      { error: "현재 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  const pwError = validatePassword(next, user.employeeId);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });
  if (next !== String(body.confirm ?? ""))
    return NextResponse.json(
      { error: "새 비밀번호가 서로 일치하지 않습니다." },
      { status: 400 },
    );
  if (await verifyPassword(next, user.passwordHash))
    return NextResponse.json(
      { error: "이전과 다른 비밀번호를 사용해주세요." },
      { status: 400 },
    );

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(next),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });
  const mine = await currentSessionToken();
  await prisma.session.deleteMany({
    where: { userId: user.id, ...(mine ? { id: { not: mine } } : {}) },
  });
  const { ip, userAgent } = getRequestMeta(req);
  void logAudit({
    action: AuditAction.PASSWORD_CHANGED,
    actorUserId: user.id,
    actorEmployeeId: user.employeeId,
    ip,
    userAgent,
  });
  return NextResponse.json({ ok: true });
}
