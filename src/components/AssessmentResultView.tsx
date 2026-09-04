"use client";

import { useState } from "react";
import { buildReportText, derivedDamagedParts, type ReportCaseInfo } from "@/lib/format-report";
import type { AssessmentResult, PartVerdict } from "@/lib/assessment-types";

const verdictColor: Record<PartVerdict, string> = {
  인정가능: "text-emerald-700",
  협의대상: "text-amber-700",
  불인정: "text-red-700",
};

export function AssessmentResultView({
  caseInfo,
  result,
}: {
  caseInfo: ReportCaseInfo;
  result: AssessmentResult;
}) {
  const [copied, setCopied] = useState(false);
  const reportText = buildReportText(caseInfo, result);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없는 브라우저 등 — 조용히 무시
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div className="font-semibold text-slate-900">손해사정 검토 결과 (AI 초안)</div>
        <button
          onClick={handleCopy}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </div>

      <div className="flex flex-col gap-5 px-6 py-5 text-sm leading-relaxed text-slate-800">
        <div className="text-slate-500">
          차량: {caseInfo.manufacturer} {caseInfo.model}
          {caseInfo.year ? ` ${caseInfo.year}년식` : ""} | 손상부위:{" "}
          {derivedDamagedParts(result, caseInfo.damagedPart)}
        </div>

        {!result.estimate_provided && (
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
            선견적 데이터가 제공되지 않아 사진 기반 손상유형 판독만 제공되었습니다.
            청구 타당성은 별도 확인이 필요합니다.
          </div>
        )}

        {result.parts.map((part, i) => (
          <div key={i}>
            <div className="font-semibold text-slate-900">
              {i + 1}. {part.part_name} <span className="font-normal text-slate-500">(청구: {part.claimed_action})</span>
            </div>
            <p className="mt-1.5">{part.reasoning}</p>
            <p className={`mt-1.5 font-semibold ${verdictColor[part.verdict]}`}>
              → 판정: {part.damage_type} · {part.verdict}
              {part.verdict === "협의대상" && part.required_action
                ? ` — ${part.required_action}`
                : ""}
            </p>
            {part.evidence_confidence === "낮음" && (
              <p className="mt-1 text-xs text-slate-400">(사진 판독 신뢰도: 낮음)</p>
            )}
            {part.labor_time_check.claimed_h !== null && (
              <p className="mt-1 text-xs text-slate-400">
                (작업시간 검토: 청구 {part.labor_time_check.claimed_h}H / 기준{" "}
                {part.labor_time_check.reference_h ?? "-"}H → {part.labor_time_check.verdict})
              </p>
            )}
            {part.ancillary_work_check.length > 0 && (
              <p className="mt-1 text-xs text-slate-400">
                (부수작업 검토:{" "}
                {part.ancillary_work_check
                  .map(
                    (a) =>
                      `${a.item}(${
                        a.in_allowed_list === null
                          ? "허용목록 미확인"
                          : a.in_allowed_list
                            ? "허용"
                            : "허용목록 외"
                      })`
                  )
                  .join(", ")}
                )
              </p>
            )}
          </div>
        ))}

        {(result.claimed_but_not_visible.length > 0 || result.damage_but_not_claimed.length > 0) && (
          <div>
            <div className="font-semibold text-red-700">청구·사진 불일치 확인사항</div>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              {result.claimed_but_not_visible.map((x, i) => (
                <li key={`v${i}`}>청구되었으나 사진상 미확인(과잉청구 의심): {x}</li>
              ))}
              {result.damage_but_not_claimed.map((x, i) => (
                <li key={`c${i}`}>사진상 확인되나 청구 누락 가능성: {x}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div className="font-semibold text-slate-900">종합 의견</div>
          <p className="mt-1.5">{result.overall_opinion}</p>
          {result.disputed_items.length > 0 && (
            <p className="mt-1.5 text-amber-700">
              협의 필요 항목: {result.disputed_items.join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
