import { prisma } from "@/lib/prisma";
import { DEFAULT_MODEL, DEFAULT_RATE } from "@/lib/pricing-defaults";
import { PricingForm } from "./PricingForm";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const rates = await prisma.pricingRate.findMany({
    orderBy: [{ model: "asc" }, { effectiveFrom: "desc" }],
    take: 50,
  });
  const current =
    rates.find(
      (r) => r.model === DEFAULT_MODEL && r.effectiveFrom <= new Date(),
    ) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">단가</h1>
        <p className="mt-1 text-sm text-slate-500">
          100만 토큰당 USD와 환율. 저장하면 이후 실행부터 적용되고, 과거 건은
          실행 시점 단가 스냅샷을 유지합니다. 초기값은 예측치이니 실제 청구
          단가로 맞춰주세요.
        </p>
      </div>

      <PricingForm
        model={DEFAULT_MODEL}
        initial={
          current
            ? {
                inputUsdPerM: current.inputUsdPerM,
                cachedInputUsdPerM: current.cachedInputUsdPerM,
                outputUsdPerM: current.outputUsdPerM,
                usdToKrw: current.usdToKrw,
              }
            : DEFAULT_RATE
        }
      />

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-500">
              <th className="px-4 py-3 font-semibold">적용 시작</th>
              <th className="px-3 py-3 font-semibold">모델</th>
              <th className="px-3 py-3 text-right font-semibold">입력 $/M</th>
              <th className="px-3 py-3 text-right font-semibold">캐시 $/M</th>
              <th className="px-3 py-3 text-right font-semibold">출력 $/M</th>
              <th className="px-3 py-3 text-right font-semibold">환율</th>
              <th className="px-3 py-3 font-semibold">변경자</th>
              <th className="px-4 py-3 font-semibold">메모</th>
            </tr>
          </thead>
          <tbody>
            {rates.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-xs text-slate-400"
                >
                  등록된 단가가 없어 초기 예측치를 쓰고 있습니다. 위에서
                  저장하면 등록됩니다.
                </td>
              </tr>
            )}
            {rates.map((r) => (
              <tr key={r.id} className="border-b border-slate-50">
                <td className="px-4 py-2.5 tabular-nums text-slate-600">
                  {r.effectiveFrom.toLocaleString("ko-KR")}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">{r.model}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {r.inputUsdPerM}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {r.cachedInputUsdPerM}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {r.outputUsdPerM}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {r.usdToKrw}
                </td>
                <td className="px-3 py-2.5 text-slate-600">
                  {r.updatedBy ?? "-"}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {r.note ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
