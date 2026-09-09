"use client";

import { useState } from "react";
import type { AncillaryWorkCheck, GeneralAssessment } from "@/lib/assessment-types";
import { TYPE_BADGE_CLASS, VERDICT_STYLES, isMinorDamageType, type ReviewItem, type VerdictLabel } from "@/lib/review-items";

const generalAssessmentBadge: Record<GeneralAssessment, string> = {
  적정: "bg-emerald-100 text-emerald-900",
  "과다 의심": "bg-amber-100 text-amber-900",
  "과소 의심": "bg-amber-100 text-amber-900",
  "판단 어려움": "bg-slate-200 text-slate-700",
};

function VerdictIcon({ verdict }: { verdict: VerdictLabel }) {
  const common = { width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
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
  const t = item.kind === "part" ? item.damageType : item.kind === "concern" ? item.damageType : undefined;
  return isMinorDamageType(t) ? t : undefined;
}

export function ReviewItemList({ items }: { items: ReviewItem[] }) {
  // 항목에 마우스를 올리면 상세 내용이 팝업으로 떴다가, 벗어나면 닫힘.
  // 터치 기기(호버 불가)에서는 같은 항목을 탭하면 토글되도록 클릭도 같이 처리.
  const [activeId, setActiveId] = useState<string | null>(null);

  const decorated = items.reduce<{ item: ReviewItem; showSectionHeader: boolean }[]>((acc, item) => {
    const prevSection = acc[acc.length - 1]?.item.section;
    acc.push({ item, showSectionHeader: item.section !== prevSection });
    return acc;
  }, []);

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
      <p className="px-2 pt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        검토 항목 ({items.length}) <span className="normal-case text-slate-300">· 항목에 마우스를 올리면 상세 표시</span>
      </p>
      {decorated.map(({ item, showSectionHeader }) => {
        const damageType = itemDamageType(item);
        return (
          <div key={item.id}>
            {showSectionHeader && (
              <p className="mt-3 mb-1 px-2 text-[10px] font-bold uppercase tracking-wide text-slate-300 first:mt-1">
                {item.section}
              </p>
            )}
            <div
              className="relative"
              onMouseEnter={() => setActiveId(item.id)}
              onMouseLeave={() => setActiveId((cur) => (cur === item.id ? null : cur))}
            >
              <button
                onClick={() => setActiveId((cur) => (cur === item.id ? null : item.id))}
                className={`flex w-full items-stretch overflow-hidden rounded-xl text-left transition-colors ${
                  activeId === item.id ? "bg-slate-100" : "hover:bg-slate-50"
                }`}
              >
                <span className={`w-1 shrink-0 ${VERDICT_STYLES[item.verdict].bar}`} />
                <span className="flex flex-1 items-center justify-between gap-3 px-3 py-3">
                  <span className="text-[13px] font-semibold leading-snug text-slate-800">{item.title}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {damageType && <span className={TYPE_BADGE_CLASS}>{damageType}</span>}
                    <VerdictBadge verdict={item.verdict} />
                  </span>
                </span>
              </button>

              {activeId === item.id && (
                <div className="absolute right-full top-0 z-30 mr-3 w-[380px] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.35)]">
                  <ReviewItemDetail item={item} />
                </div>
              )}
            </div>
          </div>
        );
      })}
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
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{section}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-base font-bold text-slate-900">{title}</h4>
          {damageType && <span className={TYPE_BADGE_CLASS}>{damageType}</span>}
          <VerdictBadge verdict={verdict} />
        </div>
      </div>
    </div>
  );
}

export function ReviewItemDetail({ item }: { item: ReviewItem | null }) {
  if (!item) {
    return <p className="text-sm text-slate-400">왼쪽 목록에서 항목을 선택하면 상세 내용이 표시됩니다.</p>;
  }

  if (item.kind === "consistency") {
    return (
      <div className="flex flex-col gap-4">
        <DetailHeader verdict={item.verdict} title={item.title} section={item.section} />
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium leading-relaxed text-slate-700">
          {item.warning}
        </p>
      </div>
    );
  }

  if (item.kind === "concern-ok") {
    return (
      <div className="flex flex-col gap-4">
        <DetailHeader verdict={item.verdict} title={item.title} section={item.section} />
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
          damageType={isMinorDamageType(item.damageType) ? item.damageType : undefined}
          section={item.section}
        />
        <p className="text-sm font-semibold leading-relaxed text-slate-800">{item.issue}</p>
        <p className="text-sm leading-relaxed text-slate-600">
          <FieldLabel>근거:</FieldLabel>
          {item.reasoning}
        </p>
      </div>
    );
  }

  if (item.kind === "mismatch") {
    return (
      <div className="flex flex-col gap-4">
        <DetailHeader verdict={item.verdict} title={item.title} section={item.section} />
        <div className="flex flex-col gap-2">
          {item.visible.map((x, i) => (
            <p key={`v${i}`} className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900">
              <FieldLabel>과잉청구 의심:</FieldLabel>
              {x}
            </p>
          ))}
          {item.claimed.map((x, i) => (
            <p key={`c${i}`} className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900">
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
        <DetailHeader verdict={item.verdict} title={item.title} section={item.section} />
        <p className="text-sm leading-relaxed text-slate-700">{item.description}</p>
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
        damageType={isMinorDamageType(part.damage_type) ? part.damage_type : undefined}
        section={item.section}
      />

      <p className="text-sm text-slate-700">
        <FieldLabel>청구:</FieldLabel>
        {part.claimed_action}
      </p>

      <p className="text-sm leading-relaxed text-slate-700">{part.reasoning}</p>

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
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">작업시간 검토</p>
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
          <p className="mt-1.5 text-xs text-slate-500">{part.labor_time_check.note}</p>
        </div>
      )}

      {part.ancillary_work_check.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-slate-200 pt-3">
          <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">부수작업 검토</p>
          {part.ancillary_work_check.map((a, j) => (
            <AncillaryRow key={j} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
