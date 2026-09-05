"use client";

import { useState } from "react";
import {
  buildProcedureReportText,
  buildProcedureSummaryText,
  type ProcedureCaseInfo,
} from "@/lib/format-procedure-report";
import type { ProcedureResult, SuspicionLevel } from "@/lib/procedure-types";

const suspicionBadge: Record<SuspicionLevel, string> = {
  높음: "bg-red-600",
  중간: "bg-amber-600",
  낮음: "bg-slate-400",
};

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

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-slate-900">손상 부위</h3>
          <div className="flex flex-wrap gap-1.5">
            {result.damaged_parts.map((part, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                title={part.reasoning}
              >
                {part.part_name}
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                  {part.damage_type}
                </span>
              </span>
            ))}
          </div>
        </div>

        {result.suspected_hidden_damage.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">정밀점검 필요 — 추정 손상</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                사람 확인 필요
              </span>
            </div>
            <p className="text-xs text-slate-500">
              사진엔 직접 보이지 않지만 충격 강도로 볼 때 의심되는 항목입니다. 실제 여부는 정비사·손해사정사가
              확인해야 합니다.
            </p>
            <div className="flex flex-col gap-2">
              {result.suspected_hidden_damage.map((issue, i) => (
                <div key={i} className="rounded-xl border-l-4 border-amber-500 bg-amber-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900">{issue.item}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${suspicionBadge[issue.suspicion_level]}`}
                    >
                      의심도 {issue.suspicion_level}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-800">{issue.reasoning}</p>
                  <p className="mt-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-amber-900">
                    확인 방법: {issue.recommended_check}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-slate-900">작업 공정</h3>
          {result.process_stages.map((stage, i) => (
            <div key={i} className="rounded-2xl bg-slate-50 p-4 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-600 text-[12px] font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-sm font-bold text-slate-900">{stage.stage_name}</p>
              </div>
              <div className="mt-3 flex flex-col gap-2.5 border-l-2 border-orange-200 pl-4">
                {stage.steps.map((step, j) => (
                  <div key={j}>
                    <p className="text-sm font-bold text-slate-800">{step.title}</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-600">{step.detail}</p>
                  </div>
                ))}
              </div>
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
