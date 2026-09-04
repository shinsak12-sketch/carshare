import { prisma } from "./prisma";

export const AuditAction = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAIL: "LOGIN_FAIL",
  LOGIN_BLOCKED: "LOGIN_BLOCKED",
  LOGOUT: "LOGOUT",
  ACCOUNT_REQUESTED: "ACCOUNT_REQUESTED",
  ACCOUNT_APPROVED: "ACCOUNT_APPROVED",
  ACCOUNT_REJECTED: "ACCOUNT_REJECTED",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  ACCOUNT_ENABLED: "ACCOUNT_ENABLED",
  ACCOUNT_PASSWORD_RESET: "ACCOUNT_PASSWORD_RESET",
  ACCOUNT_ROLE_CHANGED: "ACCOUNT_ROLE_CHANGED",
  ASSESSMENT_SUBMITTED: "ASSESSMENT_SUBMITTED",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export async function logAudit(params: {
  action: AuditActionType;
  actorUserId?: string | null;
  actorEmployeeId?: string | null;
  targetType?: string;
  targetId?: string;
  detail?: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        actorUserId: params.actorUserId ?? null,
        actorEmployeeId: params.actorEmployeeId ?? null,
        targetType: params.targetType,
        targetId: params.targetId,
        detail: params.detail,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (e) {
    // 로그 적재 실패로 본 기능(로그인 등)까지 막히면 안 되므로 콘솔에만 남김
    console.error("[audit-log] failed:", e);
  }
}

export function getRequestMeta(req: Request): { ip: string | null; userAgent: string | null } {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip");
  return { ip, userAgent: req.headers.get("user-agent") };
}
