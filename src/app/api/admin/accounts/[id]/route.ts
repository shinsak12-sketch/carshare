import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { hashPassword, validatePassword } from "@/lib/password";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";

type AccountAction =
  | "approve"
  | "reject"
  | "disable"
  | "enable"
  | "reset_password"
  | "reset_totp"
  | "set_role";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentUser();
  if (!admin) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }
  if (admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json(
      { error: "대상 계정을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: AccountAction;
    newPassword?: string;
    role?: "EMPLOYEE" | "ADMIN";
  };
  const { ip, userAgent } = getRequestMeta(req);

  const auditBase = {
    actorUserId: admin.id,
    actorEmployeeId: admin.employeeId,
    targetType: "User",
    targetId: target.id,
    ip,
    userAgent,
  };

  switch (body.action) {
    case "approve": {
      const updated = await prisma.user.update({
        where: { id },
        data: { status: "ACTIVE" },
      });
      void logAudit({
        ...auditBase,
        action: AuditAction.ACCOUNT_APPROVED,
        detail: `${target.employeeId}(${target.name}) 승인`,
      });
      return NextResponse.json({ ok: true, user: sanitize(updated) });
    }
    case "reject": {
      const updated = await prisma.user.update({
        where: { id },
        data: { status: "REJECTED" },
      });
      void logAudit({
        ...auditBase,
        action: AuditAction.ACCOUNT_REJECTED,
        detail: `${target.employeeId}(${target.name}) 거절`,
      });
      return NextResponse.json({ ok: true, user: sanitize(updated) });
    }
    case "disable": {
      const updated = await prisma.user.update({
        where: { id },
        data: { status: "DISABLED" },
      });
      await prisma.session.deleteMany({ where: { userId: id } });
      void logAudit({
        ...auditBase,
        action: AuditAction.ACCOUNT_DISABLED,
        detail: `${target.employeeId}(${target.name}) 비활성화 (세션 강제 종료 포함)`,
      });
      return NextResponse.json({ ok: true, user: sanitize(updated) });
    }
    case "enable": {
      const updated = await prisma.user.update({
        where: { id },
        data: { status: "ACTIVE" },
      });
      void logAudit({
        ...auditBase,
        action: AuditAction.ACCOUNT_ENABLED,
        detail: `${target.employeeId}(${target.name}) 재활성화`,
      });
      return NextResponse.json({ ok: true, user: sanitize(updated) });
    }
    case "reset_password": {
      const newPassword = body.newPassword?.trim() ?? "";
      const pwError = validatePassword(newPassword, target.employeeId);
      if (pwError)
        return NextResponse.json({ error: pwError }, { status: 400 });
      const passwordHash = await hashPassword(newPassword);
      // 임시 비밀번호이므로 본인이 다음 로그인 때 반드시 바꾸게 함
      await prisma.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
      });
      await prisma.session.deleteMany({ where: { userId: id } });
      void logAudit({
        ...auditBase,
        action: AuditAction.ACCOUNT_PASSWORD_RESET,
        detail: `${target.employeeId}(${target.name}) 비밀번호 관리자 초기화(다음 로그인 시 변경 강제)`,
      });
      return NextResponse.json({ ok: true });
    }
    case "reset_totp": {
      // 인증 앱을 잃어버린 경우 관리자가 해제. 본인이 다시 설정해야 함
      const updated = await prisma.user.update({
        where: { id },
        data: {
          totpSecret: null,
          totpPendingSecret: null,
          totpEnabledAt: null,
          totpRecoveryHashes: [],
        },
      });
      await prisma.session.deleteMany({ where: { userId: id } });
      void logAudit({
        ...auditBase,
        action: AuditAction.TOTP_RESET_BY_ADMIN,
        detail: `${target.employeeId}(${target.name}) 2단계 인증 관리자 해제`,
      });
      return NextResponse.json({ ok: true, user: sanitize(updated) });
    }
    case "set_role": {
      if (body.role !== "EMPLOYEE" && body.role !== "ADMIN") {
        return NextResponse.json(
          { error: "role 값이 올바르지 않습니다." },
          { status: 400 },
        );
      }
      const updated = await prisma.user.update({
        where: { id },
        data: { role: body.role },
      });
      void logAudit({
        ...auditBase,
        action: AuditAction.ACCOUNT_ROLE_CHANGED,
        detail: `${target.employeeId}(${target.name}) 역할 → ${body.role}`,
      });
      return NextResponse.json({ ok: true, user: sanitize(updated) });
    }
    default:
      return NextResponse.json(
        { error: "알 수 없는 action입니다." },
        { status: 400 },
      );
  }
}

function sanitize(user: {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  status: string;
  createdAt: Date;
  totpEnabledAt?: Date | null;
  mustChangePassword?: boolean;
}) {
  return {
    id: user.id,
    employeeId: user.employeeId,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    totpEnabled: !!user.totpEnabledAt,
    mustChangePassword: !!user.mustChangePassword,
  };
}
