"use client";

import { useMemo, useState } from "react";
import type { EstimateLine, EstimateTree as Tree } from "@/lib/estimate-tree";

// [실험] 견적서를 PDF 뷰어 대신 표로. 분류 없음, 견적서 순서 그대로.
// 열: 순번 | 배지(작업: 교환/탈착/판금/수리/도장/부품) | 작업명 | 시간 | 사정전 금액 | 사정후 금액
// 부품 행은 작업명을 두 칸 들여써서 공임과 구분. 상단 칩으로 작업별 필터.

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

const won = (n: number | null | undefined) =>
  n == null ? "" : n.toLocaleString("ko-KR");

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

const GRID =
  "grid grid-cols-[2.5rem_3.5rem_minmax(0,1fr)_3.5rem_6rem_6rem] items-center gap-x-2";

function Row({ line }: { line: EstimateLine }) {
  const badge = badgeOf(line);
  const isPart = line.kind === "부품";
  const changed =
    (line.kind === "부품"
      ? line.after.part !== line.before.part
      : line.after.labor !== line.before.labor) && line.after.labor != null;
  return (
    <div className={`${GRID} px-3 py-1.5 hover:bg-slate-50`}>
      <span className="text-right font-mono text-[10px] tabular-nums text-slate-400">
        {line.line_no}
      </span>
      <span
        className={`rounded px-1 py-px text-center text-[9px] font-bold ${BADGE[badge] ?? BADGE.기타}`}
      >
        {badge}
      </span>
      <span
        className={`min-w-0 truncate text-xs ${isPart ? "pl-6 font-normal text-slate-600" : "font-medium text-slate-800"}`}
        title={
          line.partCode
            ? `${displayName(line)} · 부품코드 ${line.partCode}`
            : displayName(line)
        }
      >
        {displayName(line)}
        {line.qty != null && line.qty !== 1 && (
          <span className="text-slate-400"> ×{line.qty}</span>
        )}
      </span>
      <span className="text-right font-mono text-[11px] tabular-nums text-slate-600">
        {line.hours != null ? `${line.hours}H` : ""}
      </span>
      <span className="text-right">
        <Amount line={line} side="before" />
      </span>
      <span className={`text-right ${changed ? "" : "opacity-60"}`}>
        <Amount line={line} side="after" />
      </span>
    </div>
  );
}

export function EstimateTreeView({ tree }: { tree: Tree }) {
  const kinds = useMemo(() => {
    const set = new Set(tree.rows.map(badgeOf));
    return ORDER.filter((k) => set.has(k)).concat(
      [...set].filter((k) => !ORDER.includes(k)),
    );
  }, [tree]);
  const [on, setOn] = useState<Set<string>>(new Set());
  const rows = on.size
    ? tree.rows.filter((l) => on.has(badgeOf(l)))
    : tree.rows;
  const labor = rows.reduce((s, l) => s + (l.before.labor ?? 0), 0);
  const part = rows.reduce((s, l) => s + (l.before.part ?? 0), 0);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of tree.rows) m.set(badgeOf(l), (m.get(badgeOf(l)) ?? 0) + 1);
    return m;
  }, [tree]);

  function toggle(k: string) {
    setOn((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  return (
    <div className="flex flex-col">
      {/* 필터 칩 + 합계 */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-3 py-2">
        <button
          type="button"
          onClick={() => setOn(new Set())}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 ${
            on.size === 0
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
        className={`${GRID} border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400`}
      >
        <span className="text-right">NO</span>
        <span className="text-center">작업</span>
        <span>작업명 / 부품명</span>
        <span className="text-right">시간</span>
        <span className="text-right">사정전</span>
        <span className="text-right">사정후</span>
      </div>

      <div className="flex flex-col divide-y divide-slate-100">
        {rows.map((l, i) => (
          <Row key={`${l.line_no}-${i}`} line={l} />
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
