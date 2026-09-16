"use client";

import type {
  EstimateGroup,
  EstimateLine,
  EstimateLineRole,
  EstimateTree as Tree,
} from "@/lib/estimate-tree";

// [실험] 견적서를 PDF 뷰어 대신 부위별 트리로.
//   [메인] 6 프런트범퍼 교환 0.8H 38,000
//     └ [부수] 12 사이드마운팅브라켓 탈착 0.2H 9,500
//     └ [도장] 5 프런트범퍼 교환도장 2.1H 185,000
//     └ [부품] 3 프런트범퍼커버 142,000

const ROLE_STYLE: Record<EstimateLineRole, string> = {
  메인: "bg-slate-900 text-white",
  부수: "bg-slate-100 text-slate-600",
  도장: "bg-sky-100 text-sky-800",
  부품: "bg-amber-100 text-amber-800",
  기타: "bg-slate-100 text-slate-500",
};
const ROLE_ORDER: Record<EstimateLineRole, number> = {
  메인: 0,
  부수: 1,
  도장: 2,
  부품: 3,
  기타: 4,
};

const won = (n: number | null) => (n == null ? "" : n.toLocaleString("ko-KR"));

function Line({ line, isMain }: { line: EstimateLine; isMain: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${isMain ? "bg-slate-50/80" : ""}`}
    >
      <span className="w-6 shrink-0 text-right font-mono text-[10px] tabular-nums text-slate-400">
        {line.line_no}
      </span>
      <span
        className={`shrink-0 rounded px-1 py-px text-[9px] font-bold ${ROLE_STYLE[line.role]}`}
      >
        {line.role}
      </span>
      <span
        className={`min-w-0 flex-1 truncate ${isMain ? "text-[13px] font-bold text-slate-900" : "text-xs font-medium text-slate-700"}`}
      >
        {line.name}
        {line.action && (
          <span className="font-normal text-slate-400"> · {line.action}</span>
        )}
        {line.qty != null && line.qty !== 1 && (
          <span className="font-normal text-slate-400"> ×{line.qty}</span>
        )}
      </span>
      {line.hours != null && (
        <span className="shrink-0 font-mono text-[11px] text-slate-500">
          {line.hours}H
        </span>
      )}
      <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-slate-700">
        {won(line.amount)}
      </span>
    </div>
  );
}

function Group({ g }: { g: EstimateGroup }) {
  const lines = [...g.lines].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.line_no - b.line_no,
  );
  const mainIdx = lines.findIndex((l) => l.role === "메인");
  const main = mainIdx >= 0 ? lines[mainIdx] : null;
  const children = lines.filter((_, i) => i !== mainIdx);
  const subtotal = g.lines.reduce((s, l) => s + (l.amount ?? 0), 0);
  return (
    <div className="px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {g.group}
        </span>
        {subtotal > 0 && (
          <span className="font-mono text-[10px] tabular-nums text-slate-400">
            소계 {won(subtotal)}
          </span>
        )}
      </div>
      {main && <Line line={main} isMain />}
      {children.length > 0 && (
        <div
          className={`${main ? "ml-3 mt-0.5 border-l-2 border-slate-200 pl-1" : ""} flex flex-col`}
        >
          {children.map((l) => (
            <div key={l.line_no} className="flex items-start gap-1">
              {main && (
                <span className="mt-1.5 shrink-0 font-mono text-[11px] text-slate-300">
                  └
                </span>
              )}
              <div className="min-w-0 flex-1">
                <Line line={l} isMain={false} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EstimateTreeView({ tree }: { tree: Tree }) {
  const s = tree.summary;
  const lineCount = tree.groups.reduce((n, g) => n + g.lines.length, 0);
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">
        <span className="font-bold text-slate-700">
          청구 항목 {lineCount}건 · 부위 {tree.groups.length}
        </span>
        {s.parts_total != null && <span>부품 {won(s.parts_total)}</span>}
        {s.labor_total != null && <span>공임 {won(s.labor_total)}</span>}
        {s.paint_total != null && <span>도장 {won(s.paint_total)}</span>}
        {s.total != null && (
          <span className="font-bold text-slate-800">합계 {won(s.total)}</span>
        )}
      </div>
      <div className="flex flex-col divide-y divide-slate-100">
        {tree.groups.map((g, i) => (
          <Group key={`${g.group}-${i}`} g={g} />
        ))}
      </div>
    </div>
  );
}
