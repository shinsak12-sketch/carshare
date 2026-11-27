"use client";

import { useMemo, useState } from "react";
import {
  workKindOf,
  type EstimateLine,
  type EstimateTree,
} from "@/lib/estimate-tree";
import type {
  AdjustmentDiagnostics,
  DiagnosticSeverity,
  ItemDiagnostic,
} from "@/lib/adjustment-review-items";
import type { AmountRow, AmountSummary } from "@/lib/adjustment-amounts";
import type { VerdictOverride } from "@/lib/adjustment-types";
import { overrideKey } from "@/lib/adjustment-overrides";
import {
  BTN,
  NEUTRAL_TONE,
  SEG_WRAP,
  VERDICT_TONE,
  confidenceTone,
  cx,
  kindColor,
  segBtn,
  won,
} from "./ui";

// 견적서 표 + 판정. 위에 판정 필터(조정/확인/통과·추론만·신뢰도)와 작업 필터 두 줄.
// 줄을 누르면 선택되고 그 줄 안에 근거 사진이 펼쳐진다. 올리면 왼쪽 사진 패널에서 강조.

const ORDER = ["교환", "탈착", "판금", "수리", "교정", "도장", "부품", "기타"];
const LOW_CONFIDENCE = 70;
const SEV: { key: DiagnosticSeverity; label: string; color: string }[] = [
  { key: "error", label: "조정", color: "#B42318" },
  { key: "warn", label: "확인", color: "#1D4ED8" },
  { key: "pass", label: "통과", color: "#00704A" },
];
const ROW_TINT: Record<string, string> = {
  과다청구: "bg-[#FFFBF5]",
  협의필요: "bg-[#F7FAFF]",
  조사필요: "bg-[#F7FAFF]",
  불인정: "bg-[#FFF8F7]",
};
const GRID =
  "grid grid-cols-[36px_46px_minmax(150px,1.1fr)_44px_72px_72px_84px_150px_minmax(230px,2fr)] gap-x-2";
const GRID_PLAIN =
  "grid grid-cols-[36px_46px_minmax(150px,1fr)_52px_96px_96px] gap-x-2";

function displayName(line: EstimateLine): string {
  if (line.action === "도장" && /(교환|보수|판금|중|상|하)$/.test(line.name))
    return `${line.name}도장`;
  return line.name;
}
const beforeOf = (l: EstimateLine) =>
  l.kind === "부품"
    ? (l.before.part ?? 0)
    : (l.before.labor ?? 0) + (l.before.part ?? 0);
const afterOf = (l: EstimateLine) =>
  l.kind === "부품"
    ? l.after.part
    : l.after.labor != null || l.after.part != null
      ? (l.after.labor ?? 0) + (l.after.part ?? 0)
      : null;

function chip(on: boolean, color: string, dashed = false) {
  return {
    className: cx(
      "inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-[13px] font-bold transition-all duration-150 active:scale-95",
      on
        ? "text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]"
        : "bg-white hover:-translate-y-px",
      !on && dashed && "border-dashed",
    ),
    style: on
      ? { background: color, borderColor: color }
      : { color, borderColor: color },
  };
}

function Row({
  line,
  judged,
  d,
  amount,
  selected,
  photoUrls,
  onSelect,
  onHover,
  onOpenPhoto,
  onOverride,
}: {
  line: EstimateLine;
  judged: boolean;
  d?: ItemDiagnostic;
  amount?: AmountRow;
  selected: boolean;
  photoUrls: string[];
  onSelect: () => void;
  onHover: (refs: number[]) => void;
  onOpenPhoto: (n: number, refs: number[], name: string) => void;
  onOverride?: (
    lineNo: string | number,
    verdict: VerdictOverride["verdict"] | null,
  ) => void;
}) {
  const kind = workKindOf(line);
  const isPart = line.kind === "부품";
  const kindBadge = (
    <span
      className={cx(
        "rounded px-0 py-0.5 text-center text-[11px] font-bold text-white",
        isPart && "ml-2.5",
      )}
      style={{ background: kindColor(kind) }}
    >
      {kind}
    </span>
  );
  const nameCell = (
    <span
      className={cx("min-w-0", isPart ? "pl-3 text-gray-700" : "font-bold")}
      title={line.partCode ? `부품코드 ${line.partCode}` : undefined}
    >
      {line.userDefined && (
        <span
          title="AOS 표준 항목이 아닌 공업사 직접 입력"
          className="mr-1.5 rounded border border-[#F1A9A0] bg-[#FDECEA] px-1 text-[11px] font-bold text-[#912018]"
        >
          사용자
        </span>
      )}
      {displayName(line)}
      {line.qty != null && line.qty !== 1 && (
        <span className="text-gray-500"> ×{line.qty}</span>
      )}
      {judged && d?.damageType && (
        <span className="ml-1.5 rounded-full border border-gray-400 px-1.5 text-[11px] font-bold text-gray-700">
          {d.damageType}
        </span>
      )}
    </span>
  );
  const hoursCell = (
    <span className="num text-right text-xs text-gray-600">
      {line.hours != null ? `${line.hours}H` : ""}
    </span>
  );
  const after = afterOf(line);

  if (!judged) {
    return (
      <div
        className={cx(
          GRID_PLAIN,
          "items-center border-b border-gray-200 px-1.5 py-2 text-[13px]",
        )}
      >
        <span className="num text-xs text-gray-600">{line.line_no}</span>
        {kindBadge}
        {nameCell}
        {hoursCell}
        <span className="num text-right text-xs">{won(beforeOf(line))}</span>
        <span className="num text-right text-xs text-gray-500">
          {won(after)}
        </span>
      </div>
    );
  }

  const it = d?.view;
  const override = it?.override;
  const follows = !!it && it.followsParent && !override;
  const refs = it?.photoRefs ?? [];
  const validRefs = refs.filter((n) => n >= 1 && n <= photoUrls.length);
  const partLinked = isPart && amount && amount.status !== "미판정";
  const label = d
    ? follows
      ? "연동"
      : d.verdict
    : partLinked
      ? `부품 ${amount!.status}`
      : "";
  const tone = d
    ? follows
      ? NEUTRAL_TONE
      : (VERDICT_TONE[d.verdict] ?? NEUTRAL_TONE)
    : partLinked
      ? amount!.status === "불인정"
        ? VERDICT_TONE.불인정
        : amount!.status === "보류" || amount!.status === "확인"
          ? VERDICT_TONE.협의필요
          : NEUTRAL_TONE
      : "";
  const diff = amount ? amount.assessed - amount.claimed : 0;
  const tint = selected
    ? "bg-[#F0F7F4] shadow-[inset_3px_0_0_#00704A]"
    : d && !follows && ROW_TINT[d.verdict]
      ? ROW_TINT[d.verdict]
      : "bg-white hover:bg-gray-50";
  const canAct = !!d && !!onOverride && (!it!.followsParent || !!override);

  return (
    <div
      data-line={line.line_no}
      onMouseEnter={d ? () => onHover(refs) : undefined}
      onMouseLeave={d ? () => onHover([]) : undefined}
      onClick={d ? onSelect : undefined}
      className={cx(
        GRID,
        "items-start border-b border-gray-200 px-1.5 py-2.5 text-[13px] transition-colors",
        d && "cursor-pointer",
        tint,
      )}
    >
      <span className="num text-xs text-gray-600">{line.line_no}</span>
      {kindBadge}
      {nameCell}
      {hoursCell}
      <span className="num text-right text-xs">{won(beforeOf(line))}</span>
      <span className="num text-right text-xs text-gray-500">{won(after)}</span>
      <span className="text-right">
        {amount && amount.status !== "미판정" ? (
          <>
            <span
              className={cx(
                "num block text-[13px] font-bold",
                diff < 0
                  ? "text-[#B42318]"
                  : amount.status === "보류" || amount.status === "확인"
                    ? "text-[#1D4ED8]"
                    : "text-gray-900",
              )}
              title={amount.note || undefined}
            >
              {won(amount.assessed)}
            </span>
            <span
              className={cx(
                "num block text-[11px]",
                diff < 0 ? "text-[#B42318]" : "text-[#1D4ED8]",
              )}
            >
              {diff !== 0
                ? `${diff > 0 ? "+" : "-"}${won(Math.abs(diff))}`
                : amount.status === "보류" || amount.status === "확인"
                  ? amount.status
                  : ""}
            </span>
          </>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-1">
        {label ? (
          <span
            className={cx(
              "whitespace-nowrap rounded-[5px] border px-2 py-0.5 text-xs font-bold",
              tone,
            )}
          >
            {label}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
        {override && it?.aiVerdict && (
          <span
            title={
              override.cascaded
                ? "같은 부위 메인 항목의 담당자 수정에 따라 바뀜"
                : "담당자가 AI 판정을 바꿈"
            }
            className="rounded-full border border-[#E9B8F0] bg-[#FBF0FD] px-[7px] py-px text-[11px] font-bold text-[#86198F]"
          >
            {override.cascaded ? "연쇄" : "담당자"}{" "}
            <s className="font-normal">{it.aiVerdict}</s>
          </span>
        )}
        {d && !follows && it!.basis === "추론" && (
          <span
            title="사진에 직접 보이지 않는 부위 — 파손 형태·충격 방향으로 추론한 판정"
            className="rounded-full border border-dashed border-[#6D28D9] px-1.5 text-[11px] font-bold text-[#6D28D9]"
          >
            추론
          </span>
        )}
        {d && !follows && typeof it!.confidence === "number" && (
          <span
            title="AI가 근거 종류로 매긴 판정 신뢰도"
            className={cx(
              "num rounded-full border px-[7px] py-px text-[11px] font-bold",
              confidenceTone(it!.confidence),
            )}
          >
            {it!.confidence}%
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-1.5">
        {d ? (
          follows ? (
            <span className="leading-relaxed text-gray-600">
              {it!.note ? `→ ${it!.note}` : "메인 작업 판정에 연동"}
            </span>
          ) : (
            <>
              <span className="leading-relaxed text-gray-700">
                {it!.reasoning}
                {it!.note && (
                  <strong className="text-gray-900"> → {it!.note}</strong>
                )}
              </span>
              {it!.extras.map((x, i) => (
                <span
                  key={i}
                  className="rounded-md bg-gray-50 px-2 py-1 text-xs leading-relaxed text-gray-700 ring-1 ring-inset ring-gray-200"
                >
                  <b className="mr-1">{x.label}</b>
                  {x.text}
                </span>
              ))}
              {(it!.evidenceLabel || refs.length > 0) && (
                <span className="flex flex-wrap items-center gap-1 text-xs text-gray-600">
                  {it!.evidenceLabel && <span>{it!.evidenceLabel}</span>}
                  {refs.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPhoto(n, refs, it!.itemName);
                      }}
                      title={`사진 ${n} 확대 (이 항목 근거 사진만 넘겨봄)`}
                      className="num h-6 min-w-7 rounded-[5px] border border-[#C5CCD6] bg-[#F3F5F7] px-1.5 text-[11px] font-bold text-gray-900 transition-colors hover:bg-gray-900 hover:text-white"
                    >
                      {n}
                    </button>
                  ))}
                </span>
              )}
              {selected && validRefs.length > 0 && (
                <span className="flex flex-wrap gap-1.5 motion-safe:animate-[fadeInUp_.2s_ease-out]">
                  {validRefs.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPhoto(n, refs, it!.itemName);
                      }}
                      aria-label={`사진 ${n} 확대`}
                      className="relative h-[72px] w-24 overflow-hidden rounded-md outline outline-2 outline-[#00704A] transition-transform hover:scale-[1.03] active:scale-95"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoUrls[n - 1]}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <span className="num absolute left-0 top-0 rounded-br-md bg-[#00704A] px-1 text-[10px] font-bold text-white">
                        {n}
                      </span>
                    </button>
                  ))}
                </span>
              )}
            </>
          )
        ) : partLinked && amount!.note ? (
          <span className="text-gray-600">→ {amount!.note}</span>
        ) : null}
        {canAct && (
          <span className="flex flex-wrap gap-1.5">
            {d!.verdict !== "인정" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOverride!(line.line_no, "인정");
                }}
                title="담당자 판단으로 인정(같은 부위의 연동·불인정 하위도 함께)"
                className="h-7 rounded-md border border-[#8CC7AD] bg-white px-2.5 text-xs font-bold text-[#00593B] transition-all hover:-translate-y-px hover:bg-[#00704A] hover:text-white active:scale-95"
              >
                인정
              </button>
            )}
            {d!.verdict !== "불인정" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOverride!(line.line_no, "불인정");
                }}
                title="담당자 판단으로 불인정(같은 부위의 하위·부품비도 함께)"
                className="h-7 rounded-md border border-[#F1A9A0] bg-white px-2.5 text-xs font-bold text-[#912018] transition-all hover:-translate-y-px hover:bg-[#B42318] hover:text-white active:scale-95"
              >
                불인정
              </button>
            )}
            {override && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOverride!(line.line_no, null);
                }}
                className="h-7 rounded-md border border-[#C5CCD6] bg-white px-2.5 text-xs font-bold text-gray-700 transition-all hover:-translate-y-px hover:bg-gray-50 active:scale-95"
              >
                AI 판정으로 되돌리기
              </button>
            )}
          </span>
        )}
      </span>
    </div>
  );
}

export function V2Table({
  tree,
  judgments,
  consistency,
  amounts,
  pdfUrl,
  parsing,
  selected,
  photoUrls,
  onSelect,
  onHover,
  onOpenPhoto,
  onOverride,
}: {
  tree: EstimateTree | null;
  judgments: Map<string, ItemDiagnostic> | null;
  consistency: AdjustmentDiagnostics["consistency"] | null;
  amounts: AmountSummary | null;
  pdfUrl: string | null;
  parsing: boolean;
  selected: string | null;
  photoUrls: string[];
  onSelect: (key: string | null) => void;
  onHover: (refs: number[]) => void;
  onOpenPhoto: (n: number, refs: number[], name: string) => void;
  onOverride?: (
    lineNo: string | number,
    verdict: VerdictOverride["verdict"] | null,
  ) => void;
}) {
  const judged = !!judgments && judgments.size > 0;
  const kinds = useMemo(() => {
    const set = new Set((tree?.rows ?? []).map(workKindOf));
    return ORDER.filter((k) => set.has(k)).concat(
      [...set].filter((k) => !ORDER.includes(k)),
    );
  }, [tree]);
  // 꺼 둔 작업 종류(기본은 전부 켜짐)
  const [off, setOff] = useState<Set<string>>(() => new Set());
  const [sevOn, setSevOn] = useState<Set<DiagnosticSeverity>>(
    () => new Set<DiagnosticSeverity>(["error", "warn"]),
  );
  const [inferredOnly, setInferredOnly] = useState(false);
  const [lowOnly, setLowOnly] = useState(false);
  const [view, setView] = useState<"table" | "pdf">("table");
  const [hidden, setHidden] = useState(false);

  const all = judgments ? [...judgments.values()] : [];
  const indep = all.filter((d) => !d.view.followsParent);
  const sevCount = (s: DiagnosticSeverity) =>
    indep.filter((d) => d.severity === s).length;
  const inferredCount = indep.filter((d) => d.view.basis === "추론").length;
  const lowCount = indep.filter(
    (d) =>
      typeof d.view.confidence === "number" &&
      d.view.confidence < LOW_CONFIDENCE,
  ).length;
  const overrideCount = all.filter(
    (d) => d.view.override && !d.view.override.cascaded,
  ).length;

  const rows = (tree?.rows ?? []).filter((l) => {
    if (off.has(workKindOf(l))) return false;
    if (!judged) return true;
    const d = judgments!.get(overrideKey(l.line_no));
    if (d?.view.override) return true; // 담당자가 바꾼 줄은 필터와 무관하게 보임
    const sev: DiagnosticSeverity =
      !d || d.view.followsParent ? "pass" : d.severity;
    if (!sevOn.has(sev)) return false;
    if (inferredOnly && d?.view.basis !== "추론") return false;
    if (
      lowOnly &&
      !(
        d &&
        typeof d.view.confidence === "number" &&
        d.view.confidence < LOW_CONFIDENCE
      )
    )
      return false;
    return true;
  });
  const labor = rows.reduce((s, l) => s + (l.before.labor ?? 0), 0);
  const part = rows.reduce((s, l) => s + (l.before.part ?? 0), 0);
  const counts = new Map<string, number>();
  for (const l of tree?.rows ?? [])
    counts.set(workKindOf(l), (counts.get(workKindOf(l)) ?? 0) + 1);
  const allOn = off.size === 0;
  const showTable = !hidden && view === "table" && !!tree;
  const showPdf = !hidden && (view === "pdf" || !tree) && !!pdfUrl;

  return (
    <section
      aria-label="견적서 판정"
      className="flex min-w-0 flex-1 flex-col bg-white"
    >
      <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 px-4 py-2.5">
        {judged && (
          <>
            <span className="mr-0.5 text-xs font-bold text-gray-600">판정</span>
            {SEV.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={sevOn.has(s.key)}
                onClick={() =>
                  setSevOn((cur) => {
                    const next = new Set(cur);
                    if (next.has(s.key)) next.delete(s.key);
                    else next.add(s.key);
                    return next;
                  })
                }
                {...chip(sevOn.has(s.key), s.color)}
              >
                {s.label} <span className="num">{sevCount(s.key)}</span>
              </button>
            ))}
            <span aria-hidden className="mx-1 h-5 w-px bg-[#D9DEE5]" />
            <button
              type="button"
              aria-pressed={inferredOnly}
              onClick={() => setInferredOnly((v) => !v)}
              title="사진에 직접 보이지 않는 부위를 추론해 판정한 항목만"
              {...chip(inferredOnly, "#6D28D9", true)}
            >
              추론만 <span className="num">{inferredCount}</span>
            </button>
            <button
              type="button"
              aria-pressed={lowOnly}
              onClick={() => setLowOnly((v) => !v)}
              title={`AI 신뢰도 ${LOW_CONFIDENCE}% 미만 판정만`}
              {...chip(lowOnly, "#93370D", true)}
            >
              신뢰도 {LOW_CONFIDENCE}%↓ <span className="num">{lowCount}</span>
            </button>
            {overrideCount > 0 && (
              <span className="inline-flex h-[26px] items-center rounded-full border border-[#E9B8F0] bg-[#FBF0FD] px-2.5 text-xs font-bold text-[#86198F]">
                담당자 수정 {overrideCount}
              </span>
            )}
          </>
        )}
        {!judged && (
          <span className="text-xs font-bold text-gray-600">청구 견적서</span>
        )}
        {parsing && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-[#00704A]">
            <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-[#8CC7AD] border-t-[#00704A]" />
            견적서 표 읽는 중…
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {tree && pdfUrl && (
            <div role="tablist" aria-label="견적서 보기" className={SEG_WRAP}>
              <button
                type="button"
                role="tab"
                aria-selected={view === "table"}
                onClick={() => setView("table")}
                className={cx(segBtn(view === "table"), "h-[26px]")}
              >
                표
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "pdf"}
                onClick={() => setView("pdf")}
                className={cx(segBtn(view === "pdf"), "h-[26px]")}
              >
                원본 PDF
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setHidden((v) => !v)}
            className={cx(BTN, "h-8 px-2.5 text-gray-700")}
          >
            {hidden ? "견적서 보기" : "견적서 숨기기"}
          </button>
        </div>
      </div>

      {showPdf && (
        <iframe
          src={`${pdfUrl}#zoom=75`}
          title="청구 견적서"
          className="m-4 h-[75vh] rounded-lg border border-[#D9DEE5]"
        />
      )}

      {showTable && (
        <>
          <div className="flex flex-wrap items-center gap-[5px] border-b border-gray-200 px-4 py-2">
            <span className="mr-0.5 text-xs font-bold text-gray-600">작업</span>
            <button
              type="button"
              aria-pressed={allOn}
              onClick={() => setOff(allOn ? new Set(kinds) : new Set())}
              title={allOn ? "전체 끄기" : "전체 켜기"}
              className={cx(
                "h-7 rounded-full border border-gray-900 px-2.5 text-xs font-bold transition-all active:scale-95",
                allOn ? "bg-gray-900 text-white" : "bg-white text-gray-900",
              )}
            >
              전체 <span className="num">{tree!.rowCount}</span>
            </button>
            {kinds.map((k) => {
              const on = !off.has(k);
              const c = kindColor(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setOff((cur) => {
                      const next = new Set(cur);
                      if (next.has(k)) next.delete(k);
                      else next.add(k);
                      return next;
                    })
                  }
                  className="h-7 rounded-full border px-2.5 text-xs font-bold transition-all active:scale-95"
                  style={
                    on
                      ? { background: c, borderColor: c, color: "#fff" }
                      : { background: "#fff", borderColor: c, color: c }
                  }
                >
                  {k} <span className="num">{counts.get(k) ?? 0}</span>
                </button>
              );
            })}
            <span className="ml-auto flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
              <span>
                공임 <span className="num">{won(labor)}</span>
              </span>
              <span>
                부품·재료 <span className="num">{won(part)}</span>
              </span>
              <strong className="text-gray-900">
                합계 <span className="num">{won(labor + part)}</span>
              </strong>
            </span>
          </div>

          {judged && consistency && (
            <div
              role="status"
              className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[#F3B27A] bg-[#FFF6EA] px-4 py-2 text-[13px] text-[#7A2E0E]"
            >
              <strong>{consistency.title}</strong>
              <span>{consistency.message}</span>
            </div>
          )}

          <div className="overflow-x-auto px-4 pb-4">
            <div className={judged ? "min-w-[940px]" : "min-w-[520px]"}>
              <div
                className={cx(
                  judged ? GRID : GRID_PLAIN,
                  "border-b border-gray-900 px-1.5 pb-2 pt-2.5 text-xs font-bold text-gray-600",
                )}
              >
                <span>NO</span>
                <span>작업</span>
                <span>작업명 / 부품명</span>
                <span className="text-right">시간</span>
                <span className="text-right">사정전</span>
                <span className="text-right">사정후</span>
                {judged && (
                  <>
                    <span className="text-right text-[#00704A]">AI 사정</span>
                    <span className="text-[#00704A]">AI 판정</span>
                    <span className="text-[#00704A]">
                      검토 의견 · 근거 사진
                    </span>
                  </>
                )}
              </div>
              {rows.map((l, i) => {
                const key = overrideKey(l.line_no);
                return (
                  <Row
                    key={`${l.line_no}-${i}`}
                    line={l}
                    judged={judged}
                    d={judged ? judgments!.get(key) : undefined}
                    amount={judged ? amounts?.rows.get(key) : undefined}
                    selected={judged && selected === key}
                    photoUrls={photoUrls}
                    onSelect={() => onSelect(selected === key ? null : key)}
                    onHover={onHover}
                    onOpenPhoto={onOpenPhoto}
                    onOverride={judged ? onOverride : undefined}
                  />
                );
              })}
              {rows.length === 0 && (
                <p className="px-2 py-7 text-center text-[13px] text-gray-600">
                  해당 항목 없음. 위 필터를 켜면 보임.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
