import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPolicy, savePolicy } from "@/lib/usage-policy";
import { UsagePolicySchema } from "@/lib/usage-policy-schema";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";

// 정책 저장(관리자). 변경 전후를 감사 로그에 남김.
export async function POST(req: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin)
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  if (admin.role !== "ADMIN")
    return NextResponse.json(
      { error: "관리자 권한이 필요합니다." },
      { status: 403 },
    );

  const parsed = UsagePolicySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "입력값을 확인해주세요." },
      { status: 400 },
    );

  const before = await getPolicy();
  await savePolicy(parsed.data, `${admin.name}(${admin.employeeId})`);

  const changed = Object.keys(parsed.data).filter(
    (k) =>
      JSON.stringify((before as Record<string, unknown>)[k]) !==
      JSON.stringify((parsed.data as Record<string, unknown>)[k]),
  );
  const { ip, userAgent } = getRequestMeta(req);
  void logAudit({
    action: AuditAction.POLICY_UPDATED,
    actorUserId: admin.id,
    actorEmployeeId: admin.employeeId,
    targetType: "AppSetting",
    targetId: "usage-policy",
    detail: changed.length
      ? changed
          .map(
            (k) =>
              `${k}: ${JSON.stringify((before as Record<string, unknown>)[k])} → ${JSON.stringify((parsed.data as Record<string, unknown>)[k])}`,
          )
          .join(" / ")
          .slice(0, 900)
      : "변경 없음",
    ip,
    userAgent,
  });
  return NextResponse.json({ ok: true });
}
