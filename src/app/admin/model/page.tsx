import { prisma } from "@/lib/prisma";
import { getModelSetting } from "@/lib/ai-model";
import { getActiveRate } from "@/lib/ai-usage";
import { MODEL_CATALOG } from "@/lib/model-catalog";
import { fmtKst } from "@/lib/kst";
import { ModelPicker } from "./ModelPicker";

export const dynamic = "force-dynamic";

export default async function ModelPage() {
  const setting = await getModelSetting();
  // 카탈로그에 없는 모델을 직접 입력해 쓰고 있으면 목록에 같이 보여줌
  const ids = new Set(MODEL_CATALOG.map((m) => m.id));
  const extra = ids.has(setting.model) ? [] : [setting.model];
  const [rates, monthRuns] = await Promise.all([
    Promise.all(
      [...MODEL_CATALOG.map((m) => m.id), ...extra].map(async (id) => [
        id,
        await getActiveRate(id),
      ]),
    ),
    prisma.aiRun.groupBy({
      by: ["model"],
      where: { status: "succeeded" },
      _count: { _all: true },
      _sum: { costKrw: true, inputTokens: true, outputTokens: true },
    }),
  ]);
  const rateMap = Object.fromEntries(
    rates.map(([id, r]) => [
      id as string,
      {
        inputUsdPerM: (r as { inputUsdPerM: number }).inputUsdPerM,
        cachedInputUsdPerM: (r as { cachedInputUsdPerM: number })
          .cachedInputUsdPerM,
        outputUsdPerM: (r as { outputUsdPerM: number }).outputUsdPerM,
        usdToKrw: (r as { usdToKrw: number }).usdToKrw,
        fromDb: (r as { id: string | null }).id != null,
      },
    ]),
  );
  const usage = Object.fromEntries(
    monthRuns.map((g) => [
      g.model,
      {
        runs: g._count._all,
        costKrw: g._sum.costKrw ?? 0,
        avgIn: g._count._all
          ? Math.round((g._sum.inputTokens ?? 0) / g._count._all)
          : 0,
        avgOut: g._count._all
          ? Math.round((g._sum.outputTokens ?? 0) / g._count._all)
          : 0,
      },
    ]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">AI 모델</h1>
        <p className="mt-1 text-sm text-slate-500">
          세 도구(선견적·손해사정·정비공정)가 공통으로 쓰는 모델과 출력 상세도.
          저장 즉시 이후 실행부터 적용되고, 실행 이력에는 건마다 쓴 모델·모드가
          남습니다. 프롬프트의 판단 기준은 모델·모드와 무관하게 동일.
          {setting.updatedAt && (
            <span className="ml-2 text-xs text-slate-400">
              마지막 변경 {fmtKst(setting.updatedAt)} ·{" "}
              {setting.updatedBy ?? "-"}
            </span>
          )}
        </p>
      </div>
      <ModelPicker
        current={setting.model}
        currentDetail={setting.detail}
        currentStrictness={setting.strictness}
        rates={rateMap}
        usage={usage}
        extraIds={extra}
      />
    </div>
  );
}
