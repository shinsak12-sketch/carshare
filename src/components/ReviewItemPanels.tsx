"use client";

import { useState } from "react";
import type {
  AncillaryWorkCheck,
  GeneralAssessment,
} from "@/lib/assessment-types";
import {
  TYPE_BADGE_CLASS,
  VERDICT_STYLES,
  isMinorDamageType,
  type ReviewItem,
  type VerdictLabel,
} from "@/lib/review-items";

const generalAssessmentBadge: Record<GeneralAssessment, string> = {
  적정: "bg-emerald-100 text-emerald-900",
  "과다 의심": "bg-amber-100 text-amber-900",
  "과소 의심": "bg-amber-100 text-amber-900",
  "판단 어려움": "bg-slate-200 text-slate-700",
};

function VerdictIcon({ verdict }: { verdict: VerdictLabel }) {
  const common = {
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (verdict) {
    case "인정":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "불인정":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case "과다청구":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <line x1="12" y1="2" x2="12" y2="22" />
          <path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7" />
        </svg>
      );
    case "조사필요":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16" y2="16" />
        </svg>
      );
    case "협의필요":
    default:
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <line x1="12" y1="8" x2="12" y2="13" />
          <line x1="12" y1="16.5" x2="12.01" y2="16.5" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

function VerdictBadge({ verdict }: { verdict: VerdictLabel }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_1px_3px_-1px_rgba(0,0,0,0.4)] ${VERDICT_STYLES[verdict].badge}`}
    >
      {verdict}
    </span>
  );
}

function itemDamageType(item: ReviewItem): string | undefined {
  const t =
    item.kind === "part"
      ? item.damageType
      : item.kind === "concern"
        ? item.damageType
        : undefined;
  return isMinorDamageType(t) ? t : undefined;
}

// 마스터-디테일: 좌측 항목 목록(단계별 카드) → 클릭하면 우측에 상세. 두 패널은 각각 독립 스크롤.
// 손해사정 화면과 같은 형태로 맞춤. 첫 진입 시 문제 항목(인정 아님) 중 첫 번째를 자동 선택.
export function ReviewMasterDetail({
  items,
  onHoverPhotos,
  onOpenPhoto,
}: {
  items: ReviewItem[];
  onHoverPhotos?: (refs: number[]) => void;
  onOpenPhoto?: (photoNo: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncedItems, setSyncedItems] = useState<ReviewItem[]>(items);
  if (items !== syncedItems) {
    setSyncedItems(items);
    setSelectedId(null);
  }
  const fallback =
    items.find((it) => it.verdict !== "인정") ?? items[0] ?? null;
  const selected = items.find((it) => it.id === selectedId) ?? fallback;

  const groups = items.reduce<{ section: string; items: ReviewItem[] }[]>(
    (acc, item) => {
      const last = acc[acc.length - 1];
      if (last && last.section === item.section) last.items.push(item);
      else acc.push({ section: item.section, items: [item] });
      return acc;
    },
    [],
  );

  const problemCount = items.filter((it) => it.verdict !== "인정").length;

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
        <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold text-white">
          확인 필요 {problemCount}
        </span>
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
                  const damageType = itemDamageType(item);
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
                        className={`w-1.5 shrink-0 ${VERDICT_STYLES[item.verdict].bar}`}
                      />
                      <span className="flex flex-1 items-center justify-between gap-2 px-3 py-2.5">
                        <span
                          className={`text-[13px] leading-snug ${isSel ? "font-bold text-slate-900" : "font-semibold text-slate-800"}`}
                        >
                          {item.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {damageType && (
                            <span className={TYPE_BADGE_CLASS}>
                              {damageType}
                            </span>
                          )}
                          <VerdictBadge verdict={item.verdict} />
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
          <ReviewItemDetail item={selected} onOpenPhoto={onOpenPhoto} />
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <b className="font-bold text-slate-500">{children} </b>;
}

function AncillaryRow({ a }: { a: AncillaryWorkCheck }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${a.mechanically_plausible ? "bg-emerald-500" : "bg-amber-500"}`}
      />
      <p className="text-xs font-medium text-slate-600">
        <span className="font-bold text-slate-700">{a.item}</span> — {a.note}
      </p>
    </div>
  );
}

function DetailHeader({
  verdict,
  title,
  damageType,
  section,
}: {
  verdict: VerdictLabel;
  title: string;
  damageType?: string;
  section: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)] ${VERDICT_STYLES[verdict].badge}`}
      >
        <VerdictIcon verdict={verdict} />
      </span>
      <div className="flex flex-1 flex-col gap-1.5 pt-0.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {section}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-base font-bold text-slate-900">{title}</h4>
          {damageType && <span className={TYPE_BADGE_CLASS}>{damageType}</span>}
          <VerdictBadge verdict={verdict} />
        </div>
      </div>
    </div>
  );
}

function PhotoRefs({
  refs,
  onOpenPhoto,
}: {
  refs: number[];
  onOpenPhoto?: (n: number) => void;
}) {
  if (!refs.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
      <span>근거사진</span>
      {refs.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onOpenPhoto?.(n)}
          className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function ReviewItemDetail({
  item,
  onOpenPhoto,
}: {
  item: ReviewItem | null;
  onOpenPhoto?: (photoNo: number) => void;
}) {
  if (!item) {
    return (
      <p className="text-sm text-slate-400">
        왼쪽 목록에서 항목을 선택하면 상세 내용이 표시됩니다.
      </p>
    );
  }

  if (item.kind === "consistency") {
    return (
      <div className="flex flex-col gap-4">
        <DetailHeader
          verdict={item.verdict}
          title={item.title}
          section={item.section}
        />
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium leading-relaxed text-slate-700">
          {item.warning}
        </p>
      </div>
    );
  }

  if (item.kind === "concern-ok") {
    return (
      <div className="flex flex-col gap-4">
        <DetailHeader
          verdict={item.verdict}
          title={item.title}
          section={item.section}
        />
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium leading-relaxed text-emerald-900">
          전체 청구 범위는 손상 정도에 비해 적정한 것으로 판단됩니다.
        </p>
      </div>
    );
  }

  if (item.kind === "concern") {
    return (
      <div className="flex flex-col gap-4">
        <DetailHeader
          verdict={item.verdict}
          title={item.title}
          damageType={
            isMinorDamageType(item.damageType) ? item.damageType : undefined
          }
          section={item.section}
        />
        <p className="text-sm font-semibold leading-relaxed text-slate-800">
          {item.issue}
        </p>
        <p className="text-sm leading-relaxed text-slate-600">
          <FieldLabel>근거:</FieldLabel>
          {item.reasoning}
        </p>
        <PhotoRefs refs={item.photoRefs} onOpenPhoto={onOpenPhoto} />
      </div>
    );
  }

  if (item.kind === "mismatch") {
    return (
      <div className="flex flex-col gap-4">
        <DetailHeader
          verdict={item.verdict}
          title={item.title}
          section={item.section}
        />
        <div className="flex flex-col gap-2">
          {item.visible.map((x, i) => (
            <p
              key={`v${i}`}
              className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900"
            >
              <FieldLabel>과잉청구 의심:</FieldLabel>
              {x}
            </p>
          ))}
          {item.claimed.map((x, i) => (
            <p
              key={`c${i}`}
              className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900"
            >
              <FieldLabel>청구 누락 의심:</FieldLabel>
              {x}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (item.kind === "finding") {
    return (
      <div className="flex flex-col gap-4">
        <DetailHeader
          verdict={item.verdict}
          title={item.title}
          section={item.section}
        />
        <p className="text-sm leading-relaxed text-slate-700">
          {item.description}
        </p>
        <p className="text-xs text-slate-400">
          <FieldLabel>근거자료:</FieldLabel>
          {item.referenceBasis}
        </p>
      </div>
    );
  }

  // part
  const { part } = item;
  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        verdict={item.verdict}
        title={part.part_name}
        damageType={
          isMinorDamageType(part.damage_type) ? part.damage_type : undefined
        }
        section={item.section}
      />

      <p className="text-sm text-slate-700">
        <FieldLabel>청구:</FieldLabel>
        {part.claimed_action}
      </p>

      <p className="text-sm leading-relaxed text-slate-700">{part.reasoning}</p>
      <PhotoRefs refs={item.photoRefs} onOpenPhoto={onOpenPhoto} />

      {part.verdict === "협의대상" && part.required_action && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.15)]">
          → {part.required_action}
        </p>
      )}

      {part.evidence_confidence === "낮음" && (
        <p className="text-xs font-medium text-slate-500">
          <FieldLabel>사진 판독 신뢰도:</FieldLabel>낮음
        </p>
      )}

      {part.labor_time_check.claimed_h !== null && (
        <div className="border-t border-slate-200 pt-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            작업시간 검토
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${generalAssessmentBadge[part.labor_time_check.general_assessment]}`}
            >
              {part.labor_time_check.general_assessment}
            </span>
            <p className="text-sm text-slate-700">
              <FieldLabel>청구:</FieldLabel>
              {part.labor_time_check.claimed_h}H
              {part.labor_time_check.reference_h !== null && (
                <>
                  {" "}
                  <FieldLabel>참고:</FieldLabel>
                  {part.labor_time_check.reference_h}H
                </>
              )}
            </p>
          </div>
          {part.labor_time_check.note && (
            <p className="mt-1.5 text-xs text-slate-500">
              {part.labor_time_check.note}
            </p>
          )}
        </div>
      )}

      {part.ancillary_work_check.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-slate-200 pt-3">
          <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            부수작업 검토
          </p>
          {part.ancillary_work_check.map((a, j) => (
            <AncillaryRow key={j} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
