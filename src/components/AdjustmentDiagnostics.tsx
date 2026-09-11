"use client";

import { useState } from "react";
import { TYPE_BADGE_CLASS, VERDICT_STYLES, type VerdictLabel } from "@/lib/review-items";
import type {
  AdjustmentDiagnostics as Diagnostics,
  DiagnosticBranch,
  DiagnosticSeverity,
  ItemDiagnostic,
} from "@/lib/adjustment-review-items";

// 우측 컬럼을 좌우 2분할: 왼쪽 = 메인 판넬(브랜치) 목록, 오른쪽 = 선택한 판넬의
// 하위 작업(메인 공임 → 도장 → 부수) 판정. 부품비는 판단 대상이 아님.
// ✖/⚠/✔ 집계는 독립 판정만(연동 항목 제외).

const SEVERITY_META: Record<DiagnosticSeverity, { glyph: string; label: string; text: string; bg: string; chip: string; chipOn: string }> = {
  error: {
    glyph: "✖",
    label: "조정",
    text: "text-red-600",
    bg: "bg-red-50",
    chip: "border-red-200 text-red-400 hover:bg-red-50",
    chipOn: "border-red-600 bg-red-600 text-white shadow-[0_4px_10px_-4px_rgba(220,38,38,0.6)]",
  },
  warn: {
    glyph: "⚠",
    label: "확인",
    text: "text-amber-600",
    bg: "bg-amber-50",
    chip: "border-amber-200 text-amber-500 hover:bg-amber-50",
    chipOn: "border-amber-500 bg-amber-500 text-white shadow-[0_4px_10px_-4px_rgba(245,158,11,0.6)]",
  },
  pass: {
    glyph: "✔",
    label: "통과",
    text: "text-emerald-600",
    bg: "bg-emerald-50",
    chip: "border-emerald-200 text-emerald-500 hover:bg-emerald-50",
    chipOn: "border-emerald-600 bg-emerald-600 text-white shadow-[0_4px_10px_-4px_rgba(5,150,105,0.6)]",
  },
};

const ROLE_LABEL: Record<ItemDiagnostic["item"]["role"], string> = { 메인: "메인", 도장: "도장", 부수: "부수" };

function VerdictBadge({ verdict, small = false }: { verdict: VerdictLabel; small?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-bold text-white shadow-[0_1px_3px_-1px_rgba(0,0,0,0.4)] ${
        small ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]"
      } ${VERDICT_STYLES[verdict].badge}`}
    >
      {verdict}
    </span>
  );
}

export function AdjustmentDiagnostics({
  diagnostics,
  onHoverPhotos,
  onOpenPhoto,
}: {
  diagnostics: Diagnostics;
  onHoverPhotos: (refs: number[]) => void;
  onOpenPhoto: (photoNo: number) => void;
}) {
  const [shown, setShown] = useState<Set<DiagnosticSeverity>>(new Set(["error", "warn"]));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 새 결과가 오면 선택 초기화 (렌더 중 상태 조정 패턴)
  const [synced, setSynced] = useState<Diagnostics | null>(null);
  if (synced !== diagnostics) {
    setSynced(diagnostics);
    setSelectedId(null);
  }

  const { consistency, branches, counts } = diagnostics;
  const visible = branches.filter((b) => shown.has(b.severity));
  const selected = visible.find((b) => b.id === selectedId) ?? visible[0] ?? null;

  function toggle(sev: DiagnosticSeverity) {
    setShown((cur) => {
      const next = new Set(cur);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  }

  return (
    <div className="flex min-h-0 flex-col gap-3 xl:h-full">
      <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
        {(["error", "warn", "pass"] as DiagnosticSeverity[]).map((sev) => {
          const m = SEVERITY_META[sev];
          const on = shown.has(sev);
          return (
            <button
              key={sev}
              type="button"
              onClick={() => toggle(sev)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold transition-all active:scale-95 ${on ? m.chipOn : `bg-white ${m.chip}`}`}
            >
              <span className="text-base leading-none">{m.glyph}</span>
              <span className="tabular-nums">{counts[sev]}</span>
              <span className="text-[11px] font-semibold opacity-80">{m.label}</span>
            </button>
          );
        })}
      </div>

      {consistency && (
        <div className="flex shrink-0 gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="w-5 shrink-0 text-center text-base font-bold text-amber-600">⚠</span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[13px] font-bold text-amber-900">{consistency.title}</span>
            <p className="text-xs leading-relaxed text-amber-900/80">{consistency.message}</p>
          </div>
        </div>
      )}

      {/* 판넬 목록과 하위 작업은 각각 독립 스크롤 */}
      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] gap-3">
        {/* 좌: 메인 판넬 목록 */}
        <div className="flex min-h-0 flex-col divide-y divide-slate-100 self-stretch overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
          {visible.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-slate-400">
              {counts.error + counts.warn === 0 ? "조정 필요 없음" : "해당 항목 없음"}
            </p>
          )}
          {visible.map((b) => {
            const m = SEVERITY_META[b.severity];
            const active = selected?.id === b.id;
            const subErr = b.children.filter((c) => !c.item.follows_parent && c.severity === "error").length;
            const subWarn = b.children.filter((c) => !c.item.follows_parent && c.severity === "warn").length;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                className={`flex items-start gap-2 px-3 py-2.5 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl ${
                  active ? `${m.bg} shadow-[inset_3px_0_0_currentColor] ${m.text}` : "hover:bg-slate-50"
                }`}
              >
                <span className={`mt-px w-4 shrink-0 text-center text-sm font-bold ${m.text}`}>{m.glyph}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className={`truncate text-[13px] font-semibold ${active ? "text-slate-900" : "text-slate-800"}`}>{b.label}</span>
                  <span className="flex flex-wrap items-center gap-1">
                    {b.main ? (
                      <VerdictBadge verdict={b.main.verdict} small />
                    ) : (
                      <span className="text-[9px] font-semibold text-slate-400">메인 없음</span>
                    )}
                    {subErr > 0 && <span className="text-[9px] font-bold text-red-600">하위 ✖{subErr}</span>}
                    {subWarn > 0 && <span className="text-[9px] font-bold text-amber-600">하위 ⚠{subWarn}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* 우: 선택한 판넬의 하위 작업 */}
        <div className="min-h-0 min-w-0 self-stretch overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
          {selected ? (
            <BranchDetail branch={selected} onHoverPhotos={onHoverPhotos} onOpenPhoto={onOpenPhoto} />
          ) : (
            <p className="px-4 py-10 text-center text-xs text-slate-400">왼쪽에서 판넬을 선택하면 하위 작업 판정이 표시됩니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function BranchDetail({
  branch,
  onHoverPhotos,
  onOpenPhoto,
}: {
  branch: DiagnosticBranch;
  onHoverPhotos: (refs: number[]) => void;
  onOpenPhoto: (photoNo: number) => void;
}) {
  const m = SEVERITY_META[branch.severity];
  return (
    <div className="flex flex-col">
      <div className={`flex items-center gap-2 rounded-t-2xl border-b border-slate-100 px-4 py-2 ${m.bg}`}>
        <span className={`text-sm font-bold ${m.text}`}>{m.glyph}</span>
        <span className="text-[13px] font-bold text-slate-800">{branch.label}</span>
        <span className="ml-auto text-[10px] text-slate-400">하위 작업 {branch.children.length + (branch.main ? 1 : 0)}건</span>
      </div>
      <div className="flex flex-col divide-y divide-slate-100">
        {branch.main && <Row d={branch.main} isMain onHoverPhotos={onHoverPhotos} onOpenPhoto={onOpenPhoto} />}
        {branch.children.map((d) => (
          <Row key={d.id} d={d} onHoverPhotos={onHoverPhotos} onOpenPhoto={onOpenPhoto} />
        ))}
      </div>
    </div>
  );
}

function Row({
  d,
  isMain = false,
  onHoverPhotos,
  onOpenPhoto,
}: {
  d: ItemDiagnostic;
  isMain?: boolean;
  onHoverPhotos: (refs: number[]) => void;
  onOpenPhoto: (photoNo: number) => void;
}) {
  const it = d.item;
  const follows = it.follows_parent && !isMain;
  const m = SEVERITY_META[d.severity];
  const refs = it.photo_refs;

  return (
    <div
      className={`flex gap-2 px-3 py-2.5 transition-colors hover:bg-slate-50 ${isMain ? "bg-slate-50/60" : ""}`}
      onMouseEnter={() => onHoverPhotos(refs)}
      onMouseLeave={() => onHoverPhotos([])}
    >
      <span className={`w-4 shrink-0 text-center text-sm font-bold ${follows ? "text-slate-300" : m.text}`}>
        {follows ? "↳" : m.glyph}
      </span>
      <span className="w-6 shrink-0 pt-0.5 text-right font-mono text-[10px] tabular-nums text-slate-400">{d.lineNo}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <span className={`leading-snug ${isMain ? "text-[13px] font-bold text-slate-900" : "text-xs font-medium text-slate-700"}`}>
            <span
              className={`mr-1 rounded px-1 py-px text-[9px] font-bold ${isMain ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}
            >
              {ROLE_LABEL[it.role]}
            </span>
            {it.item_name}
            <span className="font-normal text-slate-400"> · {it.claimed_action}</span>
            {it.claimed_hours != null && <span className="font-mono text-slate-500"> {it.claimed_hours}H</span>}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {d.damageType && <span className={TYPE_BADGE_CLASS}>{d.damageType}</span>}
            {follows ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">↳ 연동</span>
            ) : (
              <VerdictBadge verdict={it.verdict} />
            )}
          </span>
        </div>
        {follows ? (
          it.adjustment_note && <p className="text-[11px] leading-relaxed text-slate-500">→ {it.adjustment_note}</p>
        ) : (
          <p className={`text-xs leading-relaxed ${d.severity === "pass" ? "text-slate-400" : "text-slate-600"}`}>
            {it.reasoning}
            {it.adjustment_note && <span className="font-semibold text-slate-900"> → {it.adjustment_note}</span>}
          </p>
        )}
        {!follows && (
          <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
            <span>{it.photo_evidence}</span>
            {refs.length > 0 && (
              <>
                <span>· 근거사진</span>
                {refs.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onOpenPhoto(n)}
                    className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-900 hover:text-white"
                  >
                    {n}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
