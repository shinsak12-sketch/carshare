import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, destroySession } from "@/lib/session";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const { ip, userAgent } = getRequestMeta(req);

  await destroySession();

  if (user) {
    await logAudit({
      action: AuditAction.LOGOUT,
      actorUserId: user.id,
      actorEmployeeId: user.employeeId,
      ip,
      userAgent,
    });
  }

  return NextResponse.json({ ok: true });
}
