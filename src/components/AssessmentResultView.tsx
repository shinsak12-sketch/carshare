"use client";

import { useState } from "react";
import { buildReportText, derivedDamagedParts, type ReportCaseInfo } from "@/lib/format-report";
import type { AssessmentResult, GeneralAssessment, PartVerdict } from "@/lib/assessment-types";

const verdictBadge: Record<PartVerdict, string> = {
  인정가능: "bg-emerald-600",
  협의대상: "bg-amber-600",
  불인정: "bg-red-600",
};

const assessmentBadge: Record<GeneralAssessment, string> = {
  적정: "bg-emerald-100 text-emerald-900",
  "과다 의심": "bg-amber-100 text-amber-900",
  "과소 의심": "bg-amber-100 text-amber-900",
  "판단 어려움": "bg-slate-200 text-slate-700",
};

const findingBadge: Record<string, string> = {
  인정가능: "bg-emerald-600",
  협의대상: "bg-amber-600",
  불인정: "bg-red-600",
  확인불가: "bg-slate-400",
};

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[13px] font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
        {n}
      </span>
      <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
    </div>
  );
}

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
    <div className="animate-fade-in-up overflow-hidden rounded-3xl bg-white shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_36px_-16px_rgba(15,23,42,0.25),0_2px_8px_-3px_rgba(15,23,42,0.12)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">AI 검토 초안</p>
          <p className="mt-0.5 text-[15px] font-bold text-slate-900">손해사정 검토 결과</p>
        </div>
        <button
          onClick={handleCopy}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold text-white shadow-[0_2px_6px_-2px_rgba(15,23,42,0.4)] transition-all active:scale-95 ${
            copied ? "bg-emerald-600" : "bg-slate-900 hover:bg-slate-800"
          }`}
        >
          {copied ? "복사됨 ✓" : "복사"}
        </button>
      </div>

      <div className="flex flex-col gap-6 px-5 py-5 text-[14px] leading-relaxed text-slate-800">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            {caseInfo.manufacturer} {caseInfo.model}
            {caseInfo.year ? ` · ${caseInfo.year}년식` : ""}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            손상부위: {derivedDamagedParts(result, caseInfo.damagedPart)}
          </span>
        </div>

        {!result.estimate_provided && (
          <div className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-medium text-slate-600">
            선견적 데이터가 제공되지 않아 사진 기반 손상유형 판독만 제공되었습니다. 청구 타당성은 별도 확인이
            필요합니다.
          </div>
        )}

        {!result.physical_consistency.consistent && (
          <div className="flex gap-3 rounded-xl border-l-4 border-red-500 bg-red-50 px-4 py-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">
              !
            </span>
            <div>
              <p className="text-sm font-bold text-red-900">사고 정합성 경고</p>
              <p className="mt-0.5 text-sm font-medium text-red-800">{result.physical_consistency.warning}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <SectionHeader n={1} title="전체 수리범위 적정성 검토" />
          {result.overall_repair_scope_review.appropriate ? (
            <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-4 py-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                ✓
              </span>
              <p className="text-sm font-semibold text-emerald-900">
                전체 청구 범위는 손상 정도에 비해 적정합니다.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {result.overall_repair_scope_review.concerns.map((c, i) => (
                <div key={i} className="rounded-xl border-l-4 border-amber-500 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-bold text-slate-900">{c.item}</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{c.issue}</p>
                  <p className="mt-1 text-xs text-slate-500">{c.reasoning}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeader n={2} title="부위별 작업 정도 판정" />
          <div className="flex flex-col gap-3">
            {result.parts.map((part, i) => (
              <div
                key={i}
                className="rounded-2xl bg-slate-50 p-4 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">
                    {i + 1}. {part.part_name}
                    <span className="ml-1.5 font-medium text-slate-500">(청구: {part.claimed_action})</span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      {part.damage_type}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_1px_3px_-1px_rgba(0,0,0,0.4)] ${verdictBadge[part.verdict]}`}
                    >
                      {part.verdict}
                    </span>
                  </div>
                </div>

                <p className="mt-2.5 text-sm font-medium text-slate-700">{part.reasoning}</p>

                {part.verdict === "협의대상" && part.required_action && (
                  <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-amber-900 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.15)]">
                    → {part.required_action}
                  </p>
                )}

                {part.evidence_confidence === "낮음" && (
                  <p className="mt-2 text-xs font-medium text-slate-500">사진 판독 신뢰도: 낮음</p>
                )}

                {part.labor_time_check.claimed_h !== null && (
                  <div className="mt-2.5 flex items-start gap-2 border-t border-slate-200 pt-2.5">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${assessmentBadge[part.labor_time_check.general_assessment]}`}
                    >
                      {part.labor_time_check.general_assessment}
                    </span>
                    <p className="text-xs font-medium text-slate-600">
                      작업시간 청구 {part.labor_time_check.claimed_h}H
                      {part.labor_time_check.reference_h !== null
                        ? ` (참고 ${part.labor_time_check.reference_h}H)`
                        : ""}{" "}
                      — {part.labor_time_check.note}
                    </p>
                  </div>
                )}

                {part.ancillary_work_check.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5 border-t border-slate-200 pt-2.5">
                    {part.ancillary_work_check.map((a, j) => (
                      <div key={j} className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${a.mechanically_plausible ? "bg-emerald-500" : "bg-amber-500"}`}
                        />
                        <p className="text-xs font-medium text-slate-600">
                          <span className="font-bold text-slate-700">{a.item}</span> — {a.note}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {(result.claimed_but_not_visible.length > 0 || result.damage_but_not_claimed.length > 0) && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-red-900">청구·사진 불일치 확인사항</p>
            <ul className="flex flex-col gap-1.5">
              {result.claimed_but_not_visible.map((x, i) => (
                <li key={`v${i}`} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-900">
                  청구되었으나 사진상 미확인(과잉청구 의심): {x}
                </li>
              ))}
              {result.damage_but_not_claimed.map((x, i) => (
                <li key={`c${i}`} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-900">
                  사진상 확인되나 청구 누락 가능성: {x}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.other_findings.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-slate-900">기타 항목 검토</p>
            <ul className="flex flex-col gap-2">
              {result.other_findings.map((f, i) => (
                <li key={i} className="rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">{f.category}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${findingBadge[f.verdict] ?? "bg-slate-400"}`}
                    >
                      {f.verdict}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-600">{f.description}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{f.reference_basis}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)]">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">종합 의견</p>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-100">{result.overall_opinion}</p>
          {result.disputed_items.length > 0 && (
            <p className="mt-2.5 text-xs font-semibold text-amber-300">
              협의 필요 항목: {result.disputed_items.join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
