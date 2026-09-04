import { prisma } from "./prisma";
import { AuditAction } from "./audit-log";

export async function getDashboardStats() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [pendingCount, activeCount, caseCount24h, loginFail24h] = await Promise.all([
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.assessmentCase.count({ where: { createdAt: { gte: since24h } } }),
    prisma.auditLog.count({ where: { action: AuditAction.LOGIN_FAIL, createdAt: { gte: since24h } } }),
  ]);

  return { pendingCount, activeCount, caseCount24h, loginFail24h };
}
