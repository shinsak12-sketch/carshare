"use client";

import type {
  EstimateLine,
  EstimateLineKind,
  EstimateTree as Tree,
} from "@/lib/estimate-tree";

// [실험] 견적서를 PDF 뷰어 대신 표 그대로 한 줄씩. 분류 없음, 구분(부품/공임/도장) 배지만.
//   [공임] 15 리어범퍼어셈블리 · 교환 1.88H          공임 54,520
//   [부품] 16 커버－리어 범퍼 ×1                     부품 92,900
//   [도장] 17 리어범퍼 교환도장 1.59H                공임 46,110 · 재료 52,600
// 금액은 "손해 사정전(청구)" 기준, 사정후가 다르면 → 로 같이 표시.

const KIND_STYLE: Record<EstimateLineKind, string> = {
  공임: "bg-slate-900 text-white",
  도장: "bg-sky-100 text-sky-800",
  부품: "bg-amber-100 text-amber-800",
  기타: "bg-slate-100 text-slate-500",
};

const won = (n: number | null | undefined) =>
  n == null ? "" : n.toLocaleString("ko-KR");

function Money({
  label,
  before,
  after,
}: {
  label: string;
  before: number | null;
  after: number | null;
}) {
  if (!before && !after) return null;
  const changed = after != null && before != null && after !== before;
  return (
    <span className="shrink-0 whitespace-nowrap font-mono text-[11px] tabular-nums text-slate-700">
      <span className="mr-1 text-[10px] text-slate-400">{label}</span>
      {won(before)}
      {changed && <span className="text-slate-400"> → {won(after)}</span>}
    </span>
  );
}

function displayName(line: EstimateLine): { name: string; action: string } {
  // "리어범퍼 교환" + 작업 "도장" → "리어범퍼 교환도장"
  if (line.action === "도장" && /(교환|보수|판금|중|상|하)$/.test(line.name)) {
    return { name: `${line.name}도장`, action: "" };
  }
  return { name: line.name, action: line.action };
}

function Line({ line }: { line: EstimateLine }) {
  const { name, action } = displayName(line);
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50">
      <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-slate-400">
        {line.line_no}
      </span>
      <span
        className={`w-9 shrink-0 rounded px-1 py-px text-center text-[9px] font-bold ${KIND_STYLE[line.kind]}`}
      >
        {line.kind}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800"
        title={line.partCode ? `${name} · 부품코드 ${line.partCode}` : name}
      >
        {name}
        {action && (
          <span className="font-normal text-slate-400"> · {action}</span>
        )}
        {line.qty != null && line.qty !== 1 && (
          <span className="font-normal text-slate-400"> ×{line.qty}</span>
        )}
        {line.hours != null && (
          <span className="ml-1 font-mono text-[11px] font-normal text-slate-500">
            {line.hours}H
          </span>
        )}
      </span>
      <Money label="공임" before={line.before.labor} after={line.after.labor} />
      <Money
        label={line.kind === "도장" ? "재료" : "부품"}
        before={line.before.part}
        after={line.after.part}
      />
    </div>
  );
}

export function EstimateTreeView({ tree }: { tree: Tree }) {
  const labor = tree.rows.reduce((s, l) => s + (l.before.labor ?? 0), 0);
  const part = tree.rows.reduce((s, l) => s + (l.before.part ?? 0), 0);
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">
        <span className="font-bold text-slate-700">
          청구 항목 {tree.rowCount}건
        </span>
        <span>공임 {won(labor)}</span>
        <span>부품·재료 {won(part)}</span>
        <span className="font-bold text-slate-800">
          합계 {won(labor + part)}
        </span>
        <span className="text-slate-400">
          (손해 사정전 기준 · 사정후 다르면 → 표시)
        </span>
      </div>
      <div className="flex flex-col divide-y divide-slate-100">
        {tree.rows.map((l, i) => (
          <Line key={`${l.line_no}-${i}`} line={l} />
        ))}
      </div>
    </div>
  );
}
