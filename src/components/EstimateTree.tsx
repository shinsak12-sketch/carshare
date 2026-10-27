"use client";

import { useMemo, useState } from "react";
import type { EstimateLine, EstimateTree as Tree } from "@/lib/estimate-tree";
import type {
  AdjustmentDiagnostics,
  DiagnosticSeverity,
  ItemDiagnostic,
} from "@/lib/adjustment-review-items";
import { TYPE_BADGE_CLASS } from "@/lib/review-items";
import type { AmountRow, AmountSummary } from "@/lib/adjustment-amounts";
import type { VerdictOverride } from "@/lib/adjustment-types";
import {
  ConfidenceBadge,
  CostComparisonCard,
  InferredBadge,
  OverrideBadge,
  SEVERITY_META,
  VerdictBadge,
} from "./DiagnosticsPanel";

// [실험] 견적서를 PDF 뷰어 대신 표로. 분류 없음, 견적서 순서 그대로.
// 열: 순번 | 배지(작업: 교환/탈착/판금/수리/도장/부품) | 작업명 | 시간 | 사정전 금액 | 사정후 금액
// 부품 행은 작업명을 두 칸 들여써서 공임과 구분. 상단 칩으로 작업별 필터.
// 손해사정 결과(judgments)가 있으면 각 행 오른쪽에 [AI 판정 | 검토 의견] 두 열을 덧붙임 —
// 종이 견적서 옆에 펜으로 표기하듯. 별도 결과 패널 없이 이 표 하나가 결과.

const BADGE: Record<string, string> = {
  교환: "bg-rose-600 text-white",
  탈착: "bg-slate-700 text-white",
  판금: "bg-orange-600 text-white",
  수리: "bg-amber-500 text-white",
  도장: "bg-sky-600 text-white",
  부품: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300",
  기타: "bg-slate-100 text-slate-600",
};
const BADGE_ON: Record<string, string> = {
  교환: "border-rose-600 bg-rose-600 text-white",
  탈착: "border-slate-700 bg-slate-700 text-white",
  판금: "border-orange-600 bg-orange-600 text-white",
  수리: "border-amber-500 bg-amber-500 text-white",
  도장: "border-sky-600 bg-sky-600 text-white",
  부품: "border-amber-400 bg-amber-200 text-amber-900",
  기타: "border-slate-400 bg-slate-200 text-slate-800",
};
const ORDER = ["교환", "탈착", "판금", "수리", "도장", "부품", "기타"];
const SEVERITIES: DiagnosticSeverity[] = ["error", "warn", "pass"];
// 기본 표시는 조정·확인만 — 딱 봐야 할 행만 뜨게. 통과는 칩을 켜서 봄
const DEFAULT_SEV: DiagnosticSeverity[] = ["error", "warn"];

const won = (n: number | null | undefined) =>
  n == null ? "" : n.toLocaleString("ko-KR");

// 견적서 순번 "U12" ↔ AI 결과 line_no 12 를 같은 키로
export const judgmentKey = (lineNo: string | number | null | undefined) =>
  lineNo == null ? "" : String(lineNo).replace(/^U/i, "").trim();

// 배지에 쓸 작업 구분
function badgeOf(line: EstimateLine): string {
  if (line.kind === "부품") return "부품";
  if (line.kind === "도장") return "도장";
  const a = line.action.trim();
  if (!a) return "기타";
  if (/^(교환|탈착|판금|수리|도장)$/.test(a)) return a;
  if (a.includes("탈부착") || a.includes("탈착")) return "탈착";
  if (a.includes("교환")) return "교환";
  if (a.includes("판금")) return "판금";
  if (a.includes("수리")) return "수리";
  return a;
}

function displayName(line: EstimateLine): string {
  // "리어범퍼 교환" + 작업 "도장" → "리어범퍼 교환도장"
  if (line.action === "도장" && /(교환|보수|판금|중|상|하)$/.test(line.name))
    return `${line.name}도장`;
  return line.name;
}

// 금액 셀: 공임/도장은 공임(+재료), 부품은 부품가
function Amount({
  line,
  side,
}: {
  line: EstimateLine;
  side: "before" | "after";
}) {
  const v = line[side];
  if (line.kind === "부품") {
    return (
      <span className="font-mono text-[11px] tabular-nums text-slate-800">
        {won(v.part)}
      </span>
    );
  }
  return (
    <span className="flex flex-col items-end leading-tight">
      <span className="font-mono text-[11px] tabular-nums text-slate-800">
        {won(v.labor)}
      </span>
      {v.part != null && v.part > 0 && (
        <span className="font-mono text-[9px] tabular-nums text-slate-400">
          재료 {won(v.part)}
        </span>
      )}
    </span>
  );
}

const GRID_BASE =
  "grid grid-cols-[2.5rem_4.75rem_minmax(0,1fr)_3.5rem_6rem_6rem] items-center gap-x-2";
// 판정 모드: 견적 열은 그대로 두고 오른쪽에 AI 사정액 + 판정 배지 + 검토 의견(넓게) 열을 덧붙임
const GRID_JUDGED =
  "grid grid-cols-[2.5rem_4.75rem_minmax(11rem,1fr)_3.5rem_6rem_6rem_6.5rem_7rem_minmax(18rem,2.2fr)] items-start gap-x-2";
// 신뢰도 필터 기준 — 이 값 미만만 "낮은 신뢰도"로 모아 보여줌
const LOW_CONFIDENCE = 70;

// AI 사정액 셀 — 청구액과 다르면 색으로(0=불인정 빨강, 줄어듦 주황, 보류 호박)
function Assessed({ a }: { a?: AmountRow }) {
  if (!a || a.status === "미판정")
    return <span className="text-[10px] text-slate-300">—</span>;
  const diff = a.assessed - a.claimed;
  const tone =
    a.status === "불인정"
      ? "text-red-600"
      : a.status === "조정"
        ? "text-orange-600"
        : a.status === "보류"
          ? "text-amber-600"
          : a.status === "확인"
            ? "text-sky-700"
            : "text-slate-800";
  return (
    <span
      className="flex flex-col items-end leading-tight"
      title={a.note || undefined}
    >
      <span className={`font-mono text-[11px] tabular-nums ${tone}`}>
        {won(a.assessed)}
      </span>
      {diff !== 0 ? (
        <span className="font-mono text-[9px] tabular-nums text-red-500">
          {diff > 0 ? "+" : ""}
          {won(diff)}
        </span>
      ) : a.status === "보류" || a.status === "확인" ? (
        <span className="text-[9px] text-amber-600">{a.status}</span>
      ) : null}
    </span>
  );
}

// 담당자 판정 수정 버튼 — 인정/불인정으로 바꾸거나 AI 판정으로 되돌림
function OverrideButtons({
  current,
  override,
  onOverride,
}: {
  current: string;
  override?: VerdictOverride;
  onOverride: (v: VerdictOverride["verdict"] | null) => void;
}) {
  const btn =
    "rounded-md border px-1.5 py-0.5 text-[10px] font-bold transition-all active:scale-95";
  return (
    <span className="flex shrink-0 flex-wrap items-center gap-1">
      {current !== "인정" && (
        <button
          type="button"
          onClick={() => onOverride("인정")}
          title="담당자 판단으로 인정 처리(같은 부위의 연동·불인정 하위도 함께 인정)"
          className={`${btn} border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-600 hover:text-white`}
        >
          ✓ 인정
        </button>
      )}
      {current !== "불인정" && (
        <button
          type="button"
          onClick={() => onOverride("불인정")}
          title="담당자 판단으로 불인정 처리(같은 부위의 하위·부품비도 함께 불인정)"
          className={`${btn} border-red-300 bg-white text-red-700 hover:bg-red-600 hover:text-white`}
        >
          ✕ 불인정
        </button>
      )}
      {override && (
        <button
          type="button"
          onClick={() => onOverride(null)}
          title="AI 판정으로 되돌리기"
          className={`${btn} border-slate-300 bg-white text-slate-600 hover:bg-slate-800 hover:text-white`}
        >
          ↺
        </button>
      )}
    </span>
  );
}

// 행 오른쪽 검토 의견 셀 — 우측 결과 패널의 Row 내용을 한 칸에 압축
function Judgment({
  d,
  onOpenPhoto,
}: {
  d: ItemDiagnostic;
  onOpenPhoto?: (photoNo: number, refs: number[], itemName: string) => void;
}) {
  const it = d.view;
  const refs = it.photoRefs;
  if (it.followsParent) {
    return (
      <p className="text-[11px] leading-relaxed text-slate-500">
        {it.note ? `→ ${it.note}` : "메인 작업 판정에 연동"}
      </p>
    );
  }
  return (
    <div className="flex min-w-0 gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p
          className={`text-xs leading-relaxed ${d.severity === "pass" ? "text-slate-500" : "text-slate-700"}`}
        >
          {it.reasoning}
          {it.note && (
            <span className="font-semibold text-slate-900"> → {it.note}</span>
          )}
        </p>
        {it.extras.length > 0 && (
          <div className="flex flex-col gap-1">
            {it.extras.map((x, i) => (
              <p
                key={i}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
                  x.tone === "warn"
                    ? "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200/70"
                    : x.tone === "ok"
                      ? "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200/70"
                      : "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200/70"
                }`}
              >
                <span className="mr-1 font-bold">{x.label}</span>
                {x.text}
              </p>
            ))}
          </div>
        )}
        {it.costComparison && <CostComparisonCard c={it.costComparison} />}
      </div>
      {/* 근거사진은 우측에 정렬 — 의견 본문과 분리돼 한눈에 찾기 쉽게 */}
      {(it.evidenceLabel || refs.length > 0) && (
        <div className="flex max-w-[12rem] shrink-0 flex-col items-end gap-1 text-[10px] text-slate-400">
          {it.evidenceLabel && <span>{it.evidenceLabel}</span>}
          {refs.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1">
              {refs.map((n) => (
                <button
                  key={n}
                  type="button"
                  title={`사진 ${n} 확대 (이 항목 근거사진만 넘겨봄)`}
                  onClick={() => onOpenPhoto?.(n, refs, it.itemName)}
                  className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-900 hover:text-white"
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  line,
  judged,
  d,
  amount,
  onHoverPhotos,
  onOpenPhoto,
  onOverride,
}: {
  line: EstimateLine;
  judged: boolean;
  d?: ItemDiagnostic;
  amount?: AmountRow;
  onHoverPhotos?: (refs: number[]) => void;
  onOpenPhoto?: (photoNo: number, refs: number[], itemName: string) => void;
  onOverride?: (
    lineNo: string | number,
    verdict: VerdictOverride["verdict"] | null,
  ) => void;
}) {
  const badge = badgeOf(line);
  const isPart = line.kind === "부품";
  const changed =
    (line.kind === "부품"
      ? line.after.part !== line.before.part
      : line.after.labor !== line.before.labor) && line.after.labor != null;
  const override = d?.view.override;
  // 연동 행도 담당자 수정이 붙으면 자기 배지를 보여줌(연쇄로 바뀐 것이 보이게)
  const follows = !!d && d.view.followsParent && !override;
  const m = d ? SEVERITY_META[d.severity] : null;
  // 판정 모드에선 행 배경으로 심각도를 살짝 깔아 스캔이 빠르게(연동·통과·미판정은 흰색)
  const rowTint = judged && d && !follows && d.severity !== "pass" ? m!.bg : "";
  // 부품 행은 판정 대상이 아니지만 메인 불인정이면 금액이 연동됨 — 그걸 배지로
  const partLinked = isPart && amount && amount.status !== "미판정";
  const cell = judged ? "pt-0.5" : "";
  return (
    <div
      className={`${judged ? GRID_JUDGED : GRID_BASE} px-3 py-1.5 transition-colors hover:bg-slate-50 ${rowTint}`}
      onMouseEnter={
        judged && d ? () => onHoverPhotos?.(d.view.photoRefs) : undefined
      }
      onMouseLeave={judged && d ? () => onHoverPhotos?.([]) : undefined}
    >
      <span
        className={`text-right font-mono text-[10px] tabular-nums text-slate-400 ${cell}`}
      >
        {line.line_no}
      </span>
      <span className={`${isPart ? "pl-5" : ""} ${cell}`}>
        <span
          className={`inline-block w-full rounded px-1 py-px text-center text-[9px] font-bold ${BADGE[badge] ?? BADGE.기타}`}
        >
          {badge}
        </span>
      </span>
      <span
        className={`min-w-0 truncate text-xs ${isPart ? "pl-2 font-normal text-slate-600" : "font-medium text-slate-800"} ${cell}`}
        title={
          line.partCode
            ? `${displayName(line)} · 부품코드 ${line.partCode}`
            : displayName(line)
        }
      >
        {line.userDefined && (
          <span
            title="AOS 표준 항목이 아닌 공업사 직접 입력(사용자공임·사용자부품)"
            className="mr-1 rounded border border-rose-300 bg-rose-50 px-1 py-px text-[9px] font-bold text-rose-700"
          >
            사용자
          </span>
        )}
        {displayName(line)}
        {line.qty != null && line.qty !== 1 && (
          <span className="text-slate-400"> ×{line.qty}</span>
        )}
        {judged && d?.damageType && (
          <span className={`ml-1 ${TYPE_BADGE_CLASS}`}>{d.damageType}</span>
        )}
      </span>
      <span
        className={`text-right font-mono text-[11px] tabular-nums text-slate-600 ${cell}`}
      >
        {line.hours != null ? `${line.hours}H` : ""}
      </span>
      <span className={`text-right ${cell}`}>
        <Amount line={line} side="before" />
      </span>
      <span className={`text-right ${changed ? "" : "opacity-60"} ${cell}`}>
        <Amount line={line} side="after" />
      </span>
      {judged && (
        <>
          <span className={`text-right ${cell}`}>
            <Assessed a={amount} />
          </span>
          <span className="flex flex-wrap items-center gap-1 pt-px">
            {d ? (
              follows ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  ↳ 연동
                </span>
              ) : (
                <>
                  <span
                    className={`w-3.5 shrink-0 text-center text-xs font-bold ${m!.text}`}
                  >
                    {m!.glyph}
                  </span>
                  <VerdictBadge verdict={d.verdict} />
                  {override && d.view.aiVerdict && (
                    <OverrideBadge
                      aiVerdict={d.view.aiVerdict}
                      cascaded={override.cascaded}
                      small
                    />
                  )}
                  {d.view.basis === "추론" && <InferredBadge small />}
                  {typeof d.view.confidence === "number" && (
                    <ConfidenceBadge value={d.view.confidence} small />
                  )}
                </>
              )
            ) : partLinked ? (
              <span
                title={amount!.note}
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  amount!.status === "불인정"
                    ? "bg-red-100 text-red-700"
                    : amount!.status === "보류"
                      ? "bg-amber-100 text-amber-800"
                      : amount!.status === "확인"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-slate-100 text-slate-500"
                }`}
              >
                ↳ 부품 {amount!.status}
              </span>
            ) : (
              <span className="text-[10px] text-slate-300">—</span>
            )}
          </span>
          <span className="min-w-0">
            {d ? (
              <div className="flex flex-col gap-1">
                <Judgment d={d} onOpenPhoto={onOpenPhoto} />
                {onOverride && (
                  <OverrideButtons
                    current={d.verdict}
                    override={override}
                    onOverride={(v) => onOverride(line.line_no, v)}
                  />
                )}
              </div>
            ) : partLinked && amount!.note ? (
              <span className="text-[11px] text-slate-500">
                → {amount!.note}
              </span>
            ) : (
              <span className="text-[10px] text-slate-200">·</span>
            )}
          </span>
        </>
      )}
    </div>
  );
}

export function EstimateTreeView({
  tree,
  judgments,
  consistency,
  amounts,
  laborRate,
  onLaborRateChange,
  onHoverPhotos,
  onOpenPhoto,
  onOverride,
}: {
  tree: Tree;
  // line_no(문자열, U 제거) → 판정. 있으면 판정 열이 붙는다.
  judgments?: Map<string, ItemDiagnostic> | null;
  consistency?: AdjustmentDiagnostics["consistency"];
  // 손해사정 전후 금액 비교(판정 모드에서만). 있으면 AI 사정액 열과 합계가 붙는다.
  amounts?: AmountSummary | null;
  laborRate?: number | null;
  onLaborRateChange?: (rate: number | null) => void;
  onHoverPhotos?: (refs: number[]) => void;
  onOpenPhoto?: (photoNo: number, refs: number[], itemName: string) => void;
  onOverride?: (
    lineNo: string | number,
    verdict: VerdictOverride["verdict"] | null,
  ) => void;
}) {
  const judged = !!judgments && judgments.size > 0;
  const kinds = useMemo(() => {
    const set = new Set(tree.rows.map(badgeOf));
    return ORDER.filter((k) => set.has(k)).concat(
      [...set].filter((k) => !ORDER.includes(k)),
    );
  }, [tree]);
  // 필터 = "보이는 작업 집합". 기본은 전부 켜짐. "전체" 칩은 전부 켜기/끄기 토글이라
  // 부품만 빼고 보려면 부품 칩 하나만 끄고, 하나만 보려면 전체를 꺼서 비운 뒤 그 칩만 켜면 됨.
  const [on, setOn] = useState<Set<string>>(() => new Set(kinds));
  // 판정 필터(조정/확인/통과). 기본은 통과 꺼짐. 연동·미판정 행은 "통과" 칩을 따라감(문제 없는 행이니까).
  const [sevOn, setSevOn] = useState<Set<DiagnosticSeverity>>(
    () => new Set(DEFAULT_SEV),
  );
  // "추론만": 사진에 안 보이는 부위를 충격 경로로 추론한 판정만 남김(담당자 별도 검토용)
  const [inferredOnly, setInferredOnly] = useState(false);
  // "낮은 신뢰도만": confidence가 기준 미만인 판정만
  const [lowConfOnly, setLowConfOnly] = useState(false);
  const [syncedTree, setSyncedTree] = useState<Tree>(tree);
  if (syncedTree !== tree) {
    setSyncedTree(tree);
    setOn(new Set(kinds));
    setSevOn(new Set(DEFAULT_SEV));
    setInferredOnly(false);
    setLowConfOnly(false);
  }
  const allOn = kinds.every((k) => on.has(k));

  const sevOfLine = (l: EstimateLine): DiagnosticSeverity => {
    const d = judgments?.get(judgmentKey(l.line_no));
    if (!d || d.view.followsParent) return "pass";
    return d.severity;
  };
  const isInferred = (l: EstimateLine) =>
    judgments?.get(judgmentKey(l.line_no))?.view.basis === "추론";
  const isLowConf = (l: EstimateLine) => {
    const c = judgments?.get(judgmentKey(l.line_no))?.view.confidence;
    return typeof c === "number" && c < LOW_CONFIDENCE;
  };
  // 담당자가 바꾼 행은 필터와 무관하게 항상 보이게(바꿔 놓고 사라지면 당황하니까)
  const isOverridden = (l: EstimateLine) =>
    !!judgments?.get(judgmentKey(l.line_no))?.view.override;
  const rows = tree.rows.filter(
    (l) =>
      on.has(badgeOf(l)) &&
      (isOverridden(l) ||
        ((!judged || sevOn.has(sevOfLine(l))) &&
          (!inferredOnly || isInferred(l)) &&
          (!lowConfOnly || isLowConf(l)))),
  );
  const labor = rows.reduce((s, l) => s + (l.before.labor ?? 0), 0);
  const part = rows.reduce((s, l) => s + (l.before.part ?? 0), 0);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of tree.rows) m.set(badgeOf(l), (m.get(badgeOf(l)) ?? 0) + 1);
    return m;
  }, [tree]);
  // 판정 집계: 독립 판정만(연동 제외) — 결과 패널의 ✖/⚠/✔ 건수와 같은 기준
  const sevCounts = useMemo(() => {
    const c: Record<DiagnosticSeverity, number> = {
      error: 0,
      warn: 0,
      pass: 0,
    };
    if (!judgments) return c;
    for (const d of judgments.values())
      if (!d.view.followsParent) c[d.severity] += 1;
    return c;
  }, [judgments]);
  const inferredCount = useMemo(() => {
    if (!judgments) return 0;
    let n = 0;
    for (const d of judgments.values())
      if (!d.view.followsParent && d.view.basis === "추론") n += 1;
    return n;
  }, [judgments]);
  const lowConfCount = useMemo(() => {
    if (!judgments) return 0;
    let n = 0;
    for (const d of judgments.values())
      if (
        !d.view.followsParent &&
        typeof d.view.confidence === "number" &&
        d.view.confidence < LOW_CONFIDENCE
      )
        n += 1;
    return n;
  }, [judgments]);
  const overrideCount = useMemo(() => {
    if (!judgments) return 0;
    let n = 0;
    for (const d of judgments.values())
      if (d.view.override && !d.view.override.cascaded) n += 1;
    return n;
  }, [judgments]);

  function toggle(k: string) {
    setOn((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }
  function toggleSev(s: DiagnosticSeverity) {
    setSevOn((cur) => {
      const next = new Set(cur);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const grid = judged ? GRID_JUDGED : GRID_BASE;

  return (
    <div className="flex flex-col">
      {/* 판정 칩(조정/확인/통과) — 결과가 있을 때만 */}
      {judged && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
          {SEVERITIES.map((sev) => {
            const m = SEVERITY_META[sev];
            const isOn = sevOn.has(sev);
            return (
              <button
                key={sev}
                type="button"
                onClick={() => toggleSev(sev)}
                className={`flex min-w-[88px] items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-bold transition-all active:scale-95 ${isOn ? m.chipOn : `bg-white ${m.chip}`}`}
              >
                <span className="text-base leading-none">{m.glyph}</span>
                <span className="tabular-nums">{sevCounts[sev]}</span>
                <span className="text-[11px] font-semibold opacity-80">
                  {m.label}
                </span>
              </button>
            );
          })}
          {inferredCount > 0 && (
            <button
              type="button"
              onClick={() => setInferredOnly((v) => !v)}
              title="사진에 직접 보이지 않는 부위를 충격 경로로 추론해 판정한 항목만 보기"
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-bold transition-all active:scale-95 ${
                inferredOnly
                  ? "border-violet-600 bg-violet-600 text-white shadow-[0_4px_10px_-4px_rgba(124,58,237,0.6)]"
                  : "border-dashed border-violet-300 bg-white text-violet-600 hover:bg-violet-50"
              }`}
            >
              <span className="tabular-nums">{inferredCount}</span>
              <span className="text-[11px] font-semibold opacity-80">
                추론만
              </span>
            </button>
          )}
          {lowConfCount > 0 && (
            <button
              type="button"
              onClick={() => setLowConfOnly((v) => !v)}
              title={`AI 신뢰도 ${LOW_CONFIDENCE}% 미만 판정만 보기`}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-bold transition-all active:scale-95 ${
                lowConfOnly
                  ? "border-amber-600 bg-amber-600 text-white shadow-[0_4px_10px_-4px_rgba(217,119,6,0.6)]"
                  : "border-dashed border-amber-400 bg-white text-amber-700 hover:bg-amber-50"
              }`}
            >
              <span className="tabular-nums">{lowConfCount}</span>
              <span className="text-[11px] font-semibold opacity-80">
                신뢰도 {LOW_CONFIDENCE}%↓
              </span>
            </button>
          )}
          {overrideCount > 0 && (
            <span className="rounded-full border border-fuchsia-300 bg-fuchsia-50 px-2.5 py-1 text-[11px] font-bold text-fuchsia-800">
              담당자 수정 {overrideCount}
            </span>
          )}
          <span className="text-[11px] text-slate-400">
            행에 마우스를 올리면 근거사진이 표시됨
          </span>
        </div>
      )}
      {/* 금액 비교 — 청구 vs AI 사정(담당자 수정 반영) + 수가 입력 */}
      {judged && amounts && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[11px]">
          <span className="flex flex-col leading-tight">
            <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
              청구
            </span>
            <span className="font-mono text-sm font-bold tabular-nums text-slate-800">
              {won(amounts.claimedTotal)}
            </span>
          </span>
          <span className="text-slate-300">→</span>
          <span className="flex flex-col leading-tight">
            <span className="text-[9px] font-bold uppercase tracking-wide text-fuchsia-600">
              AI 사정
            </span>
            <span className="font-mono text-sm font-bold tabular-nums text-fuchsia-800">
              {won(amounts.assessedTotal)}
            </span>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[9px] font-bold uppercase tracking-wide text-red-500">
              삭감
            </span>
            <span className="font-mono text-sm font-bold tabular-nums text-red-600">
              {won(amounts.cut)}
              <span className="ml-1 text-[10px] font-semibold">
                ({Math.round(amounts.cutRate * 100)}%)
              </span>
            </span>
          </span>
          {amounts.held > 0 && (
            <span className="flex flex-col leading-tight">
              <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600">
                보류(협의·조사)
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-amber-700">
                {won(amounts.held)}
              </span>
            </span>
          )}
          {amounts.pendingHours > 0 && (
            <span
              title="시간 과다로 과다청구했지만 인정 시간이 없어 청구액 그대로 둔 행"
              className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800"
            >
              금액 확인 {amounts.pendingHours}건
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5 text-slate-500">
            <span className="font-semibold">수가</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder="견적서 금액"
              value={laborRate ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                onLaborRateChange?.(v === "" ? null : Math.max(0, Number(v)));
              }}
              title="거래처 수가(원/H). 입력하면 시간이 있는 공임·도장 행을 시간×수가로 다시 계산. 비우면 견적서 금액 그대로"
              className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-right font-mono text-[11px] tabular-nums text-slate-800 focus:border-fuchsia-400 focus:outline-none"
            />
            <span>원/H</span>
          </span>
        </div>
      )}
      {judged && consistency && (
        <div className="flex gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
          <span className="w-5 shrink-0 text-center text-base font-bold text-amber-600">
            ⚠
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px] font-bold text-amber-900">
              {consistency.title}
            </span>
            <p className="text-xs leading-relaxed text-amber-900/80">
              {consistency.message}
            </p>
          </div>
        </div>
      )}

      {/* 필터 칩 + 합계 */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-3 py-2">
        <button
          type="button"
          onClick={() => setOn(allOn ? new Set() : new Set(kinds))}
          title={allOn ? "전체 끄기" : "전체 켜기"}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 ${
            allOn
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          전체 {tree.rowCount}
        </button>
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => toggle(k)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 ${
              on.has(k)
                ? (BADGE_ON[k] ?? BADGE_ON.기타)
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {k} {counts.get(k) ?? 0}
          </button>
        ))}
        <span className="ml-auto flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500">
          <span>공임 {won(labor)}</span>
          <span>부품·재료 {won(part)}</span>
          <span className="font-bold text-slate-800">
            합계 {won(labor + part)}
          </span>
        </span>
      </div>

      {/* 열 머리 */}
      <div
        className={`${grid} border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400`}
      >
        <span className="text-right">NO</span>
        <span className="text-center">작업</span>
        <span>작업명 / 부품명</span>
        <span className="text-right">시간</span>
        <span className="text-right">사정전</span>
        <span className="text-right">사정후</span>
        {judged && (
          <>
            <span className="text-right text-fuchsia-700">AI 사정</span>
            <span className="text-fuchsia-700">AI 판정</span>
            <span className="text-fuchsia-700">검토 의견</span>
          </>
        )}
      </div>

      <div className="flex flex-col divide-y divide-slate-100">
        {rows.map((l, i) => (
          <Row
            key={`${l.line_no}-${i}`}
            line={l}
            judged={judged}
            d={judged ? judgments!.get(judgmentKey(l.line_no)) : undefined}
            amount={
              judged ? amounts?.rows.get(judgmentKey(l.line_no)) : undefined
            }
            onHoverPhotos={onHoverPhotos}
            onOpenPhoto={onOpenPhoto}
            onOverride={judged ? onOverride : undefined}
          />
        ))}
        {rows.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-slate-400">
            해당 항목 없음
          </p>
        )}
      </div>
    </div>
  );
}
