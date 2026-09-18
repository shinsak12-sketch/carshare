"use client";

import { useState } from "react";
import type { RepairPlan } from "@/lib/adjustment-types";
import { InferredBadge } from "@/components/DiagnosticsPanel";

// 1단계(정비사) 결과 — 수리 계획. 항목별 판정(2단계)이 이 계획 위에서 내려졌다는 걸
// 담당자가 먼저 보게 한다. 접근·분해 경로는 메인 작업별로 묶어서 접었다 펼침.
export function RepairPlanPanel({
  plan,
  compact = false,
}: {
  plan: RepairPlan;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const byWork = new Map<string, RepairPlan["access_path"]>();
  for (const a of plan.access_path) {
    const list = byWork.get(a.for_work) ?? [];
    list.push(a);
    byWork.set(a.for_work, list);
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
          1단계 · 정비사
        </span>
        <span className="text-sm font-bold text-slate-900">수리 계획</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {plan.vehicle_structure}
        </span>
        <span className="text-[11px] text-slate-500">
          메인 {plan.main_works.length} · 경로 {plan.access_path.length} ·
          불필요 {plan.rejected.length}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto rounded-full border border-slate-300 px-3 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
        >
          {open ? "접기 ▲" : "펼치기 ▾"}
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-700">
        {plan.damage_summary}
      </p>
      {open && (
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              메인 작업
            </div>
            <ul className="flex flex-col gap-1">
              {plan.main_works.map((w, i) => (
                <li
                  key={i}
                  className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs ring-1 ring-inset ring-slate-200/70"
                >
                  <span className="font-bold text-slate-900">
                    {w.part_name}
                  </span>
                  <span className="ml-1 rounded bg-slate-900 px-1 py-px text-[9px] font-bold text-white">
                    {w.work}
                  </span>
                  {w.judgment_basis === "추론" && (
                    <span className="ml-1">
                      <InferredBadge small />
                    </span>
                  )}
                  <div className="text-[11px] leading-snug text-slate-600">
                    {w.reasoning}
                  </div>
                </li>
              ))}
            </ul>
            {plan.rejected.length > 0 && (
              <>
                <div className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-wide text-red-500">
                  계획 밖 청구 (불인정)
                </div>
                <ul className="flex flex-col gap-1">
                  {plan.rejected.map((r, i) => (
                    <li
                      key={i}
                      className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs ring-1 ring-inset ring-red-200"
                    >
                      <span className="mr-1 font-mono text-[10px] text-red-400">
                        {r.line_no}
                      </span>
                      <span className="font-semibold text-red-900">
                        {r.item_name}
                      </span>
                      <div className="text-[11px] leading-snug text-red-800">
                        {r.reasoning}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              접근·분해 경로 (파손 여부와 무관)
            </div>
            <div className="flex flex-col gap-2">
              {[...byWork.entries()].map(([work, list]) => (
                <div
                  key={work}
                  className="rounded-lg bg-violet-50/60 px-2.5 py-1.5 ring-1 ring-inset ring-violet-200/70"
                >
                  <div className="text-[11px] font-bold text-violet-900">
                    {work}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {list.map((a, i) => (
                      <span
                        key={i}
                        title={a.reasoning}
                        className="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                      >
                        {a.item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {plan.access_path.length === 0 && (
                <p className="text-[11px] text-slate-400">경로 항목 없음</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
