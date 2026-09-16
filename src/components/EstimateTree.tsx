"use client";

import type {
  EstimateGroup,
  EstimateLine,
  EstimateLineRole,
  EstimateTree as Tree,
} from "@/lib/estimate-tree";

// [실험] 견적서를 PDF 뷰어 대신 부위별 트리로. GPT 없이 표를 그대로 읽어 규칙으로 묶은 것.
//   [메인] 15 리어범퍼어셈블리 · 교환 1.88H        공임 54,520
//     └ [부품] 16 커버－리어 범퍼 ×1               부품 92,900
//     └ [도장] 17 리어범퍼 교환도장 1.59H           공임 46,110 · 재료 52,600
//     └ [부수] 18 리어범퍼사이드마운팅브라켓 · 교환 0.1H  공임 2,900
// 금액은 "손해 사정전(청구)" 기준, 사정후가 다르면 → 로 같이 표시.

const ROLE_STYLE: Record<EstimateLineRole, string> = {
  메인: "bg-slate-900 text-white",
  부수: "bg-slate-100 text-slate-600",
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

function Line({ line, isMain }: { line: EstimateLine; isMain: boolean }) {
  const { name, action } = displayName(line);
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${isMain ? "bg-slate-50/80" : ""}`}
    >
      <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-slate-400">
        {line.line_no}
      </span>
      <span
        className={`shrink-0 rounded px-1 py-px text-[9px] font-bold ${ROLE_STYLE[line.role]}`}
      >
        {line.role}
      </span>
      <span
        className={`min-w-0 flex-1 truncate ${isMain ? "text-[13px] font-bold text-slate-900" : "text-xs font-medium text-slate-700"}`}
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

function Group({ g }: { g: EstimateGroup }) {
  const mainIdx = g.lines.findIndex((l) => l.role === "메인");
  const main = mainIdx >= 0 ? g.lines[mainIdx] : null;
  const children = g.lines.filter((_, i) => i !== mainIdx);
  const labor = g.lines.reduce((s, l) => s + (l.before.labor ?? 0), 0);
  const part = g.lines.reduce((s, l) => s + (l.before.part ?? 0), 0);
  return (
    <div className="px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {g.group}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-slate-400">
          {labor > 0 && <>공임 {won(labor)}</>}
          {labor > 0 && part > 0 && " · "}
          {part > 0 && <>부품·재료 {won(part)}</>}
        </span>
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
  const all = tree.groups.flatMap((g) => g.lines);
  const labor = all.reduce((s, l) => s + (l.before.labor ?? 0), 0);
  const part = all.reduce((s, l) => s + (l.before.part ?? 0), 0);
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">
        <span className="font-bold text-slate-700">
          청구 항목 {tree.rowCount}건 · 부위 {tree.groups.length}
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
        {tree.groups.map((g, i) => (
          <Group key={`${g.group}-${i}`} g={g} />
        ))}
      </div>
    </div>
  );
}
