"use client";

import { useState } from "react";
import {
  buildProcedureReportText,
  buildProcedureSummaryText,
  type ProcedureCaseInfo,
} from "@/lib/format-procedure-report";
import type { ProcedureResult } from "@/lib/procedure-types";

export function ProcedureResultView({
  caseInfo,
  result,
}: {
  caseInfo: ProcedureCaseInfo;
  result: ProcedureResult;
}) {
  const [copied, setCopied] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const reportText = buildProcedureReportText(caseInfo, result);
  const summaryText = buildProcedureSummaryText(result);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없는 브라우저 등 — 조용히 무시
    }
  }

  async function handleCopySummary() {
    try {
      await navigator.clipboard.writeText(summaryText);
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 1500);
    } catch {
      // 조용히 무시
    }
  }

  return (
    <div className="animate-fade-in-up overflow-hidden rounded-3xl bg-white shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_36px_-16px_rgba(15,23,42,0.25),0_2px_8px_-3px_rgba(15,23,42,0.12)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            AI 사전판단 · 선견적 이전
          </p>
          <p className="mt-0.5 text-[15px] font-bold text-slate-900">정비공정 판단 결과</p>
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
        {(caseInfo.manufacturer || caseInfo.model) && (
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
              {caseInfo.manufacturer} {caseInfo.model}
            </span>
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
          {result.parts.map((part, i) => (
            <div key={i} className="rounded-2xl bg-slate-50 p-4 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">
                  {i + 1}. {part.part_name}
                </p>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
                  {part.damage_type}
                </span>
              </div>

              <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-900">
                권장 작업: {part.recommended_action}
              </p>

              <p className="mt-2.5 text-sm font-medium text-slate-700">{part.reasoning}</p>

              {part.evidence_confidence === "낮음" && (
                <p className="mt-2 text-xs font-medium text-slate-500">사진 판독 신뢰도: 낮음</p>
              )}

              <div className="mt-2.5 border-t border-slate-200 pt-2.5">
                <p className="text-xs font-medium text-slate-600">{part.labor_estimate_note}</p>
              </div>

              {part.ancillary_work.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5 border-t border-slate-200 pt-2.5">
                  {part.ancillary_work.map((a, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
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

        <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">종합 요약</p>
            <button
              onClick={handleCopySummary}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all active:scale-95 ${
                summaryCopied ? "bg-emerald-600" : "bg-white/15 hover:bg-white/25"
              }`}
            >
              {summaryCopied ? "복사됨 ✓" : "복사"}
            </button>
          </div>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-100">{result.overall_summary}</p>
        </div>
      </div>
    </div>
  );
}
