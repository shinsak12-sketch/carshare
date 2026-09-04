import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";

const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const { ip, userAgent } = getRequestMeta(req);
  const form = await req.formData();
  const employeeId = String(form.get("employeeId") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!employeeId || !password) {
    return NextResponse.json({ error: "사번과 비밀번호를 입력해주세요." }, { status: 400 });
  }

  // 차단 여부 조회와 계정 조회는 서로 의존하지 않으므로 병렬로 보내 왕복 횟수를 줄임
  const [recentFails, user] = await Promise.all([
    prisma.auditLog.count({
      where: {
        action: AuditAction.LOGIN_FAIL,
        actorEmployeeId: employeeId,
        createdAt: { gte: new Date(Date.now() - FAIL_WINDOW_MS) },
      },
    }),
    prisma.user.findUnique({ where: { employeeId } }),
  ]);
  if (recentFails >= MAX_FAILS) {
    await logAudit({
      action: AuditAction.LOGIN_BLOCKED,
      actorEmployeeId: employeeId,
      detail: `최근 ${FAIL_WINDOW_MS / 60000}분 내 실패 ${recentFails}회로 임시 차단`,
      ip,
      userAgent,
    });
    return NextResponse.json(
      { error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !passwordOk) {
    await logAudit({
      action: AuditAction.LOGIN_FAIL,
      actorEmployeeId: employeeId,
      ip,
      userAgent,
    });
    return NextResponse.json(
      { error: "사번 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  if (user.status === "PENDING") {
    return NextResponse.json(
      { error: "계정 승인 대기 중입니다. 관리자 승인 후 이용 가능합니다." },
      { status: 403 }
    );
  }
  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "이용이 제한된 계정입니다. 관리자에게 문의해주세요." },
      { status: 403 }
    );
  }

  await createSession(user.id, { ip, userAgent });
  await logAudit({
    action: AuditAction.LOGIN_SUCCESS,
    actorUserId: user.id,
    actorEmployeeId: user.employeeId,
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true, role: user.role });
}
