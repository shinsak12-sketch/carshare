"use client";

import { useMemo, useState } from "react";
import { TYPE_BADGE_CLASS, VERDICT_STYLES, type VerdictLabel } from "@/lib/review-items";
import type { PhotoEvidence } from "@/lib/adjustment-types";
import type { AdjustmentReviewItem } from "@/lib/adjustment-review-items";

const ALL_VERDICTS: VerdictLabel[] = ["인정", "협의필요", "과다청구", "조사필요", "불인정"];
const ALL_EVIDENCE: PhotoEvidence[] = ["직접확인", "간접확인", "확인불가"];

const EVIDENCE_STYLES: Record<PhotoEvidence, string> = {
  직접확인: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  간접확인: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  확인불가: "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200",
};

function VerdictBadge({ verdict }: { verdict: VerdictLabel }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_1px_3px_-1px_rgba(0,0,0,0.4)] ${VERDICT_STYLES[verdict].badge}`}
    >
      {verdict}
    </span>
  );
}

function ActionBadge({ action, hours }: { action: string; hours: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
      {action}
      {hours != null && <span className="text-slate-400">· {hours}H</span>}
    </span>
  );
}

function EvidenceBadge({ evidence }: { evidence: PhotoEvidence }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${EVIDENCE_STYLES[evidence]}`}>
      {evidence}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <b className="font-bold text-slate-500">{children} </b>;
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

export function AdjustmentItemList({ items }: { items: AdjustmentReviewItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<Set<VerdictLabel>>(new Set(ALL_VERDICTS));
  const [evidenceFilter, setEvidenceFilter] = useState<Set<PhotoEvidence>>(new Set(ALL_EVIDENCE));

  const verdictCounts = useMemo(() => {
    const counts = new Map<VerdictLabel, number>();
    items.forEach((it) => counts.set(it.verdict, (counts.get(it.verdict) ?? 0) + 1));
    return counts;
  }, [items]);

  const evidenceCounts = useMemo(() => {
    const counts = new Map<PhotoEvidence, number>();
    items.forEach((it) => {
      if (it.kind === "item") counts.set(it.item.photo_evidence, (counts.get(it.item.photo_evidence) ?? 0) + 1);
    });
    return counts;
  }, [items]);

  const filteredItems = items.filter((it) => {
    if (!verdictFilter.has(it.verdict)) return false;
    if (it.kind === "item" && !evidenceFilter.has(it.item.photo_evidence)) return false;
    return true;
  });

  const groups = filteredItems.reduce<{ section: string; items: AdjustmentReviewItem[] }[]>((acc, item) => {
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
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
        <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          판정 필터 · {filteredItems.length}/{items.length}건 표시
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_VERDICTS.filter((v) => (verdictCounts.get(v) ?? 0) > 0).map((v) => {
            const active = verdictFilter.has(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => setVerdictFilter((s) => toggleInSet(s, v))}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 ${
                  active ? `text-white shadow-sm ${VERDICT_STYLES[v].badge}` : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                }`}
              >
                {v} {verdictCounts.get(v)}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_EVIDENCE.filter((e) => (evidenceCounts.get(e) ?? 0) > 0).map((e) => {
            const active = evidenceFilter.has(e);
            return (
              <button
                key={e}
                type="button"
                onClick={() => setEvidenceFilter((s) => toggleInSet(s, e))}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 ${
                  active ? EVIDENCE_STYLES[e] : "bg-slate-100 text-slate-400 hover:bg-slate-200 ring-1 ring-inset ring-transparent"
                }`}
              >
                {e} {evidenceCounts.get(e)}
              </button>
            );
          })}
        </div>
      </div>

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
                  <span className="flex flex-1 flex-col gap-1.5 px-3 py-3">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold leading-snug text-slate-800">{item.title}</span>
                      <VerdictBadge verdict={item.verdict} />
                    </span>
                    {item.kind === "item" && (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <ActionBadge action={item.item.claimed_action} hours={item.item.claimed_hours} />
                        <EvidenceBadge evidence={item.item.photo_evidence} />
                        {item.damageType && <span className={TYPE_BADGE_CLASS}>{item.damageType}</span>}
                      </span>
                    )}
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

      {groups.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center text-sm text-slate-400">
          선택한 필터에 해당하는 항목이 없습니다.
        </p>
      )}
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
        {item.damageType && <span className={TYPE_BADGE_CLASS}>{item.damageType}</span>}
        <VerdictBadge verdict={adj.verdict} />
      </div>

      <p className="text-sm text-slate-700">
        <FieldLabel>청구:</FieldLabel>
        {adj.claimed_action}
        {adj.claimed_hours != null && ` (${adj.claimed_hours}H)`}
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
