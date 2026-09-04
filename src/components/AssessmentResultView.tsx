import type { AssessmentResult, PartVerdict } from "@/lib/assessment-types";

const verdictStyle: Record<PartVerdict, string> = {
  인정가능: "bg-emerald-50 text-emerald-700 border-emerald-200",
  협의대상: "bg-amber-50 text-amber-700 border-amber-200",
  불인정: "bg-red-50 text-red-700 border-red-200",
};

export function AssessmentResultView({ result }: { result: AssessmentResult }) {
  return (
    <div className="flex flex-col gap-4">
      {!result.estimate_provided && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          선견적 데이터가 제공되지 않았습니다. 아래는 사진 기반 손상유형 판독 결과이며,
          청구 타당성(작업유형·시간·부수작업)은 비교 대상이 없어 판단하지 않았습니다.
        </div>
      )}

      {result.parts.map((part, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-900">{part.part_name}</div>
              <div className="text-sm text-slate-500">
                청구: {part.claimed_action} · 판정유형: {part.damage_type} · 신뢰도:{" "}
                {part.evidence_confidence}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${verdictStyle[part.verdict]}`}
            >
              {part.verdict}
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-slate-700">{part.reasoning}</p>

          <div className="mt-3 text-xs text-slate-500">
            작업시간 검토: 청구 {part.labor_time_check.claimed_h ?? "-"}H / 기준{" "}
            {part.labor_time_check.reference_h ?? "-"}H → {part.labor_time_check.verdict}
          </div>

          {part.ancillary_work_check.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-500">
              {part.ancillary_work_check.map((a, j) => (
                <li key={j}>
                  · {a.item} —{" "}
                  {a.in_allowed_list === null ? "허용목록 미확인" : a.in_allowed_list ? "허용" : "허용목록 외"}
                  {a.note ? ` (${a.note})` : ""}
                </li>
              ))}
            </ul>
          )}

          {part.required_action && (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              필요 조치: {part.required_action}
            </div>
          )}
        </div>
      ))}

      {(result.claimed_but_not_visible.length > 0 || result.damage_but_not_claimed.length > 0) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="font-semibold text-red-700">청구·사진 불일치</div>
          {result.claimed_but_not_visible.length > 0 && (
            <div className="mt-2 text-sm text-red-700">
              <div className="font-medium">청구됐으나 사진에서 미확인 (과잉청구 의심)</div>
              <ul className="mt-1 list-disc pl-5">
                {result.claimed_but_not_visible.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {result.damage_but_not_claimed.length > 0 && (
            <div className="mt-2 text-sm text-red-700">
              <div className="font-medium">사진엔 있으나 청구 누락 가능성</div>
              <ul className="mt-1 list-disc pl-5">
                {result.damage_but_not_claimed.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="font-semibold text-slate-900">종합 의견</div>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{result.overall_opinion}</p>
        {result.disputed_items.length > 0 && (
          <div className="mt-3 text-sm text-amber-700">
            협의 필요 항목: {result.disputed_items.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}
