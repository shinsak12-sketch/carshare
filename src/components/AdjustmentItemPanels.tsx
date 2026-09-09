"use client";

import { useState } from "react";
import { VERDICT_STYLES, type VerdictLabel } from "@/lib/review-items";
import type { AdjustmentReviewItem } from "@/lib/adjustment-review-items";

function VerdictBadge({ verdict }: { verdict: VerdictLabel }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_1px_3px_-1px_rgba(0,0,0,0.4)] ${VERDICT_STYLES[verdict].badge}`}
    >
      {verdict}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <b className="font-bold text-slate-500">{children} </b>;
}

export function AdjustmentItemList({ items }: { items: AdjustmentReviewItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const groups = items.reduce<{ section: string; items: AdjustmentReviewItem[] }[]>((acc, item) => {
    const last = acc[acc.length - 1];
    if (last && last.section === item.section) {
      last.items.push(item);
    } else {
      acc.push({ section: item.section, items: [item] });
    }
    return acc;
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        검토 항목 ({items.length}) <span className="normal-case text-slate-300">· 항목에 마우스를 올리면 상세 표시</span>
      </p>
      {groups.map((group, gi) => (
        <div
          key={gi}
          className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]"
        >
          <p className="rounded-t-2xl border-b border-slate-200 bg-slate-100 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">
            {group.section}
          </p>
          <div className="flex flex-col divide-y divide-slate-100">
            {group.items.map((item) => (
              <div
                key={item.id}
                className="relative"
                onMouseEnter={() => setActiveId(item.id)}
                onMouseLeave={() => setActiveId((cur) => (cur === item.id ? null : cur))}
              >
                <button
                  onClick={() => setActiveId((cur) => (cur === item.id ? null : item.id))}
                  className={`flex w-full items-stretch overflow-hidden text-left transition-colors ${
                    activeId === item.id ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                >
                  <span className={`w-1.5 shrink-0 ${VERDICT_STYLES[item.verdict].bar}`} />
                  <span className="flex flex-1 items-center justify-between gap-3 px-3 py-3">
                    <span className="text-[13px] font-semibold leading-snug text-slate-800">{item.title}</span>
                    <VerdictBadge verdict={item.verdict} />
                  </span>
                </button>

                {activeId === item.id && (
                  <div className="absolute left-full top-0 z-30 ml-3 w-[380px] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.35)]">
                    <AdjustmentItemDetail item={item} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdjustmentItemDetail({ item }: { item: AdjustmentReviewItem | null }) {
  if (!item) {
    return <p className="text-sm text-slate-400">왼쪽 목록에서 항목을 선택하면 상세 내용이 표시됩니다.</p>;
  }

  if (item.kind === "consistency") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-base font-bold text-slate-900">{item.title}</h4>
          <VerdictBadge verdict={item.verdict} />
        </div>
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium leading-relaxed text-slate-700">
          {item.warning}
        </p>
      </div>
    );
  }

  const { item: adj } = item;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-base font-bold text-slate-900">{adj.item_name}</h4>
        <VerdictBadge verdict={adj.verdict} />
      </div>

      <p className="text-sm text-slate-700">
        <FieldLabel>청구:</FieldLabel>
        {adj.claimed_action}
      </p>
      <p className="text-sm text-slate-700">
        <FieldLabel>사진 확인:</FieldLabel>
        {adj.photo_evidence}
      </p>

      <p className="text-sm leading-relaxed text-slate-700">{adj.reasoning}</p>

      {adj.verdict !== "인정" && adj.adjustment_note && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.15)]">
          → {adj.adjustment_note}
        </p>
      )}
    </div>
  );
}
