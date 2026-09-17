import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getActiveRate } from "@/lib/ai-usage";
import { computeCost } from "@/lib/pricing-defaults";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";

// 기존 실행 기록의 비용을 현재 단가로 다시 계산(관리자). 단가 확정 전에 쌓인 건을 맞추는 용도.
// 스냅샷 원칙의 예외이므로 감사 로그에 건수·단가를 남김.
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

  const body = (await req.json().catch(() => ({}))) as { model?: string };
  const model =
    typeof body.model === "string" && body.model ? body.model : null;
  if (!model)
    return NextResponse.json({ error: "모델이 필요합니다." }, { status: 400 });

  const rate = await getActiveRate(model);
  const runs = await prisma.aiRun.findMany({
    where: { model, status: { in: ["succeeded", "failed"] } },
    select: {
      id: true,
      inputTokens: true,
      cachedInputTokens: true,
      outputTokens: true,
      reasoningTokens: true,
    },
  });
  let total = 0;
  await prisma.$transaction(
    runs.map((r) => {
      const { costUsd, costKrw } = computeCost(r, rate);
      total += costKrw;
      return prisma.aiRun.update({
        where: { id: r.id },
        data: {
          costUsd,
          costKrw,
          rateSnapshot: { ...rate, recalculatedAt: new Date().toISOString() },
        },
      });
    }),
  );

  const { ip, userAgent } = getRequestMeta(req);
  void logAudit({
    action: AuditAction.PRICING_UPDATED,
    actorUserId: admin.id,
    actorEmployeeId: admin.employeeId,
    targetType: "AiRun",
    detail: `비용 재계산 ${runs.length}건 (${model} 입력 ${rate.inputUsdPerM} / 캐시 ${rate.cachedInputUsdPerM} / 출력 ${rate.outputUsdPerM} $/M · 환율 ${rate.usdToKrw}) → 합계 ${total.toLocaleString("ko-KR")}원`,
    ip,
    userAgent,
  });
  return NextResponse.json({ ok: true, count: runs.length, totalKrw: total });
}
