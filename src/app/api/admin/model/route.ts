import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getModelSetting, saveModelSetting } from "@/lib/ai-model";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";

// AI 모델 변경(관리자). 저장 즉시 이후 실행부터 적용. 진행 중인 백그라운드 작업은 영향 없음.
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

  const body = (await req.json().catch(() => ({}))) as { model?: unknown };
  const model =
    typeof body.model === "string" ? body.model.trim().slice(0, 80) : "";
  // OpenAI 모델 ID 형식만 허용(영문·숫자·.-_/ )
  if (!model || !/^[a-zA-Z0-9][a-zA-Z0-9._\-/]*$/.test(model))
    return NextResponse.json(
      { error: "모델 ID 형식이 올바르지 않습니다." },
      { status: 400 },
    );

  const before = await getModelSetting();
  await saveModelSetting(model, `${admin.name}(${admin.employeeId})`);

  const { ip, userAgent } = getRequestMeta(req);
  void logAudit({
    action: AuditAction.MODEL_CHANGED,
    actorUserId: admin.id,
    actorEmployeeId: admin.employeeId,
    targetType: "AppSetting",
    targetId: "ai-model",
    detail: `${before.model} → ${model}`,
    ip,
    userAgent,
  });
  return NextResponse.json({ ok: true, model });
}
