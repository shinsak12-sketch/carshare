"use client";

import { useState } from "react";
import { TYPE_BADGE_CLASS } from "@/lib/review-items";
import {
  PROCEDURE_BADGE_STYLES,
  type ProcedureBadge,
  type ProcedureReviewItem,
} from "@/lib/procedure-review-items";

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

// 마스터-디테일: 좌측 항목 목록 → 클릭하면 우측에 상세. 각각 독립 스크롤. 손해사정·선견적과 같은 형태.
export function ProcedureMasterDetail({
  items,
  onHoverPhotos,
  onOpenPhoto,
}: {
  items: ProcedureReviewItem[];
  onHoverPhotos?: (refs: number[]) => void;
  onOpenPhoto?: (photoNo: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncedItems, setSyncedItems] = useState<ProcedureReviewItem[]>(items);
  if (items !== syncedItems) {
    setSyncedItems(items);
    setSelectedId(null);
  }
  const fallback =
    items.find((it) => it.badge !== "손상없음") ?? items[0] ?? null;
  const selected = items.find((it) => it.id === selectedId) ?? fallback;

  const groups = items.reduce<
    { section: string; items: ProcedureReviewItem[] }[]
  >((acc, item) => {
    const last = acc[acc.length - 1];
    if (last && last.section === item.section) last.items.push(item);
    else acc.push({ section: item.section, items: [item] });
    return acc;
  }, []);

  const hiddenCount = items.filter((it) => it.kind === "hidden").length;

  return (
    <div className="flex min-h-0 flex-col gap-3 xl:h-full">
      <div className="flex shrink-0 items-center justify-between gap-3 px-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          검토 항목 ({items.length})
          <span className="normal-case text-slate-300">
            {" "}
            · 항목을 누르면 우측에 상세
          </span>
        </p>
        {hiddenCount > 0 && (
          <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold text-white">
            정밀점검 {hiddenCount}
          </span>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[300px_1fr]">
        <div className="flex min-h-0 flex-col gap-3 self-stretch overflow-y-auto pr-0.5">
          {groups.map((group, gi) => (
            <div
              key={gi}
              className="shrink-0 rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]"
            >
              <p className="rounded-t-2xl border-b border-slate-200 bg-slate-100 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                {group.section}
              </p>
              <div className="flex flex-col divide-y divide-slate-100">
                {group.items.map((item) => {
                  const isSel = selected?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      onMouseEnter={() => onHoverPhotos?.(item.photoRefs)}
                      onMouseLeave={() => onHoverPhotos?.([])}
                      className={`flex w-full items-stretch overflow-hidden text-left transition-colors last:rounded-b-2xl ${
                        isSel
                          ? "bg-slate-100 shadow-[inset_3px_0_0_rgb(15,23,42)]"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`w-1.5 shrink-0 ${PROCEDURE_BADGE_STYLES[item.badge].bar}`}
                      />
                      <span className="flex flex-1 items-center justify-between gap-2 px-3 py-2.5">
                        <span
                          className={`text-[13px] leading-snug ${isSel ? "font-bold text-slate-900" : "font-semibold text-slate-800"}`}
                        >
                          {item.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {item.kind === "part" && item.damageType && (
                            <span className={TYPE_BADGE_CLASS}>
                              {item.damageType}
                            </span>
                          )}
                          <BadgePill badge={item.badge} />
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="min-h-0 min-w-0 self-stretch overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
          <ProcedureItemDetail item={selected} onOpenPhoto={onOpenPhoto} />
        </div>
      </div>
    </div>
  );
}

function PhotoRefs({
  refs,
  label,
  onOpenPhoto,
}: {
  refs: number[];
  label: string;
  onOpenPhoto?: (n: number) => void;
}) {
  if (!refs.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
      <span>{label}</span>
      {refs.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onOpenPhoto?.(n)}
          className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 shadow-sm transition-colors hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700"
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function ProcedureItemDetail({
  item,
  onOpenPhoto,
}: {
  item: ProcedureReviewItem | null;
  onOpenPhoto?: (photoNo: number) => void;
}) {
  if (!item) {
    return (
      <p className="text-sm text-slate-400">
        왼쪽 목록에서 항목을 선택하면 상세 내용이 표시됩니다.
      </p>
    );
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
        <p className="text-sm leading-relaxed text-slate-700">
          {part.reasoning}
        </p>
        <PhotoRefs
          refs={item.photoRefs}
          label="근거사진"
          onOpenPhoto={onOpenPhoto}
        />
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
      <p className="text-sm leading-relaxed text-slate-700">
        {hidden.reasoning}
      </p>
      <PhotoRefs
        refs={item.photoRefs}
        label="단서사진"
        onOpenPhoto={onOpenPhoto}
      />
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
        <FieldLabel>확인 방법:</FieldLabel>
        {hidden.recommended_check}
      </p>
    </div>
  );
}
