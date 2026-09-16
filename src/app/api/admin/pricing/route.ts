import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";

// 단가 등록(관리자). 기존 행을 고치지 않고 새 행을 추가 — 과거 건의 스냅샷과 이력이 보존됨.
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

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const n = (k: string) => {
    const v = Number(body[k]);
    return Number.isFinite(v) && v >= 0 ? v : null;
  };
  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : null;
  const inputUsdPerM = n("inputUsdPerM");
  const cachedInputUsdPerM = n("cachedInputUsdPerM");
  const outputUsdPerM = n("outputUsdPerM");
  const usdToKrw = n("usdToKrw");
  if (
    !model ||
    inputUsdPerM == null ||
    cachedInputUsdPerM == null ||
    outputUsdPerM == null ||
    usdToKrw == null ||
    usdToKrw === 0
  )
    return NextResponse.json(
      { error: "입력값을 확인해주세요." },
      { status: 400 },
    );

  const rate = await prisma.pricingRate.create({
    data: {
      model,
      inputUsdPerM,
      cachedInputUsdPerM,
      outputUsdPerM,
      usdToKrw,
      updatedBy: `${admin.name}(${admin.employeeId})`,
      note: typeof body.note === "string" ? body.note.slice(0, 200) : null,
    },
  });

  const { ip, userAgent } = getRequestMeta(req);
  void logAudit({
    action: AuditAction.PRICING_UPDATED,
    actorUserId: admin.id,
    actorEmployeeId: admin.employeeId,
    targetType: "PricingRate",
    targetId: rate.id,
    detail: `${model} 입력 ${inputUsdPerM} / 캐시 ${cachedInputUsdPerM} / 출력 ${outputUsdPerM} $/M · 환율 ${usdToKrw}`,
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true, id: rate.id });
}
