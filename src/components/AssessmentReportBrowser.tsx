"use client";

import { useMemo, useState } from "react";
import type {
  AncillaryWorkCheck,
  AssessmentResult,
  GeneralAssessment,
  OtherFindingVerdict,
  PartAssessment,
  PartVerdict,
} from "@/lib/assessment-types";

type Verdict = "emerald" | "amber" | "red" | "slate";

const VERDICT_STYLES: Record<Verdict, { bar: string; badge: string }> = {
  emerald: { bar: "bg-emerald-500", badge: "bg-emerald-600 text-white" },
  amber: { bar: "bg-amber-500", badge: "bg-amber-600 text-white" },
  red: { bar: "bg-red-500", badge: "bg-red-600 text-white" },
  slate: { bar: "bg-slate-300", badge: "bg-slate-400 text-white" },
};

const partVerdictColor: Record<PartVerdict, Verdict> = {
  인정가능: "emerald",
  협의대상: "amber",
  불인정: "red",
};

const findingVerdictColor: Record<OtherFindingVerdict, Verdict> = {
  인정가능: "emerald",
  협의대상: "amber",
  불인정: "red",
  확인불가: "slate",
};

const generalAssessmentBadge: Record<GeneralAssessment, string> = {
  적정: "bg-emerald-100 text-emerald-900",
  "과다 의심": "bg-amber-100 text-amber-900",
  "과소 의심": "bg-amber-100 text-amber-900",
  "판단 어려움": "bg-slate-200 text-slate-700",
};

type ReviewItem =
  | { id: string; kind: "consistency"; verdict: Verdict; title: string; label: string; warning: string }
  | { id: string; kind: "concern-ok"; verdict: Verdict; title: string; label: string }
  | {
      id: string;
      kind: "concern";
      verdict: Verdict;
      title: string;
      label: string;
      item: string;
      issue: string;
      reasoning: string;
    }
  | { id: string; kind: "part"; verdict: Verdict; title: string; label: string; part: PartAssessment }
  | { id: string; kind: "mismatch"; verdict: Verdict; title: string; label: string; visible: string[]; claimed: string[] }
  | {
      id: string;
      kind: "finding";
      verdict: Verdict;
      title: string;
      label: string;
      description: string;
      referenceBasis: string;
    };

function buildReviewItems(result: AssessmentResult): ReviewItem[] {
  const items: ReviewItem[] = [];

  if (!result.physical_consistency.consistent) {
    items.push({
      id: "consistency",
      kind: "consistency",
      verdict: "red",
      title: "사고 정합성 경고",
      label: "경고",
      warning: result.physical_consistency.warning,
    });
  }

  if (result.overall_repair_scope_review.appropriate) {
    items.push({ id: "scope-ok", kind: "concern-ok", verdict: "emerald", title: "전체 수리범위", label: "적정" });
  } else {
    result.overall_repair_scope_review.concerns.forEach((c, i) => {
      // 관련 부위의 판정 색을 이어받으면 전체 범위 검토 카드도 심각도별로 구분됨
      const matched = result.parts.find(
        (p) => c.item.includes(p.part_name) || p.part_name.includes(c.item)
      );
      items.push({
        id: `concern-${i}`,
        kind: "concern",
        verdict: matched ? partVerdictColor[matched.verdict] : "amber",
        title: c.item,
        label: "전체범위",
        item: c.item,
        issue: c.issue,
        reasoning: c.reasoning,
      });
    });
  }

  result.parts.forEach((part, i) => {
    items.push({
      id: `part-${i}`,
      kind: "part",
      verdict: partVerdictColor[part.verdict],
      title: `${i + 1}. ${part.part_name}`,
      label: part.verdict,
      part,
    });
  });

  if (result.claimed_but_not_visible.length > 0 || result.damage_but_not_claimed.length > 0) {
    items.push({
      id: "mismatch",
      kind: "mismatch",
      verdict: "red",
      title: "청구·사진 불일치",
      label: "확인필요",
      visible: result.claimed_but_not_visible,
      claimed: result.damage_but_not_claimed,
    });
  }

  result.other_findings.forEach((f, i) => {
    items.push({
      id: `finding-${i}`,
      kind: "finding",
      verdict: findingVerdictColor[f.verdict],
      title: f.category,
      label: f.verdict,
      description: f.description,
      referenceBasis: f.reference_basis,
    });
  });

  return items;
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

function ItemDetail({ item }: { item: ReviewItem }) {
  if (item.kind === "consistency") {
    return (
      <div>
        <h4 className="text-base font-bold text-red-900">사고 정합성 경고</h4>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700">{item.warning}</p>
      </div>
    );
  }

  if (item.kind === "concern-ok") {
    return (
      <div>
        <h4 className="text-base font-bold text-emerald-900">전체 수리범위 적정성 검토</h4>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700">
          전체 청구 범위는 손상 정도에 비해 적정한 것으로 판단됩니다.
        </p>
      </div>
    );
  }

  if (item.kind === "concern") {
    return (
      <div>
        <h4 className="text-base font-bold text-slate-900">{item.item}</h4>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">{item.issue}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          <FieldLabel>근거:</FieldLabel>
          {item.reasoning}
        </p>
      </div>
    );
  }

  if (item.kind === "mismatch") {
    return (
      <div>
        <h4 className="text-base font-bold text-red-900">청구·사진 불일치 확인사항</h4>
        <div className="mt-3 flex flex-col gap-2">
          {item.visible.map((x, i) => (
            <p key={`v${i}`} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
              <FieldLabel>과잉청구 의심:</FieldLabel>
              {x}
            </p>
          ))}
          {item.claimed.map((x, i) => (
            <p key={`c${i}`} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
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
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-base font-bold text-slate-900">{item.title}</h4>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${VERDICT_STYLES[item.verdict].badge}`}>
            {item.label}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.description}</p>
        <p className="mt-2 text-xs text-slate-400">
          <FieldLabel>근거자료:</FieldLabel>
          {item.referenceBasis}
        </p>
      </div>
    );
  }

  // part
  const { part } = item;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-base font-bold text-slate-900">{part.part_name}</h4>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
          {part.damage_type}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${VERDICT_STYLES[partVerdictColor[part.verdict]].badge}`}>
          {part.verdict}
        </span>
      </div>

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

export function AssessmentReportBrowser({ result }: { result: AssessmentResult }) {
  const items = useMemo(() => buildReviewItems(result), [result]);
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  // 새 진단 결과(items 배열이 새로 생성됨)가 들어오면 선택을 첫 항목으로
  // 리셋 — 렌더 중 상태 조정 패턴(이펙트 없이 처리해 캐스케이드 렌더 방지).
  const [itemsForSelection, setItemsForSelection] = useState(items);
  if (items !== itemsForSelection) {
    setItemsForSelection(items);
    setSelectedId(items[0]?.id ?? null);
  }

  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)] lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto">
        <p className="px-2 pt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          검토 항목 ({items.length})
        </p>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedId(item.id)}
            className={`flex items-stretch overflow-hidden rounded-xl text-left transition-colors ${
              selected?.id === item.id ? "bg-slate-100" : "hover:bg-slate-50"
            }`}
          >
            <span className={`w-1 shrink-0 ${VERDICT_STYLES[item.verdict].bar}`} />
            <span className="flex flex-1 items-center justify-between gap-2 px-3 py-2.5">
              <span className="text-[13px] font-semibold text-slate-800">{item.title}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${VERDICT_STYLES[item.verdict].badge}`}
              >
                {item.label}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="min-h-[240px] rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)] lg:sticky lg:top-6">
        {selected ? (
          <ItemDetail item={selected} />
        ) : (
          <p className="text-sm text-slate-400">왼쪽 목록에서 항목을 선택하면 상세 내용이 표시됩니다.</p>
        )}
      </div>
    </div>
  );
}
