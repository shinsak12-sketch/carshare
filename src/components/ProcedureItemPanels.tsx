"use client";

import { useState } from "react";
import { TYPE_BADGE_CLASS } from "@/lib/review-items";
import { PROCEDURE_BADGE_STYLES, type ProcedureBadge, type ProcedureReviewItem } from "@/lib/procedure-review-items";

function BadgePill({ badge }: { badge: ProcedureBadge }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_1px_3px_-1px_rgba(0,0,0,0.4)] ${PROCEDURE_BADGE_STYLES[badge].badge}`}
    >
      {badge}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <b className="font-bold text-slate-500">{children} </b>;
}

export function ProcedureItemList({ items }: { items: ProcedureReviewItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const groups = items.reduce<{ section: string; items: ProcedureReviewItem[] }[]>((acc, item) => {
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
                  <span className={`w-1.5 shrink-0 ${PROCEDURE_BADGE_STYLES[item.badge].bar}`} />
                  <span className="flex flex-1 items-center justify-between gap-3 px-3 py-3">
                    <span className="text-[13px] font-semibold leading-snug text-slate-800">{item.title}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {item.kind === "part" && item.damageType && (
                        <span className={TYPE_BADGE_CLASS}>{item.damageType}</span>
                      )}
                      <BadgePill badge={item.badge} />
                    </span>
                  </span>
                </button>

                {activeId === item.id && (
                  <div className="absolute left-full top-0 z-30 ml-3 w-[380px] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.35)]">
                    <ProcedureItemDetail item={item} />
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

export function ProcedureItemDetail({ item }: { item: ProcedureReviewItem | null }) {
  if (!item) {
    return <p className="text-sm text-slate-400">왼쪽 목록에서 항목을 선택하면 상세 내용이 표시됩니다.</p>;
  }

  const header = (title: string, damageType?: string) => (
    <div className="flex flex-wrap items-center gap-2">
      <h4 className="text-base font-bold text-slate-900">{title}</h4>
      {damageType && <span className={TYPE_BADGE_CLASS}>{damageType}</span>}
      <BadgePill badge={item.badge} />
    </div>
  );

  if (item.kind === "consistency") {
    return (
      <div className="flex flex-col gap-3">
        {header(item.title)}
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium leading-relaxed text-slate-700">
          {item.warning}
        </p>
      </div>
    );
  }

  if (item.kind === "part") {
    const { part } = item;
    return (
      <div className="flex flex-col gap-3">
        {header(part.part_name, item.damageType)}
        <p className="text-sm leading-relaxed text-slate-700">{part.reasoning}</p>
        {part.evidence_confidence === "낮음" && (
          <p className="text-xs font-medium text-slate-500">
            <FieldLabel>사진 판독 신뢰도:</FieldLabel>낮음
          </p>
        )}
      </div>
    );
  }

  // hidden
  const { hidden } = item;
  return (
    <div className="flex flex-col gap-3">
      {header(hidden.item)}
      <p className="text-sm leading-relaxed text-slate-700">{hidden.reasoning}</p>
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
        <FieldLabel>확인 방법:</FieldLabel>
        {hidden.recommended_check}
      </p>
    </div>
  );
}
