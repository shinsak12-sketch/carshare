"use client";

import { useMemo, useState } from "react";
import { TYPE_BADGE_CLASS, VERDICT_STYLES, type VerdictLabel } from "@/lib/review-items";
import type { AdjustmentDiagnostic, DiagnosticSeverity } from "@/lib/adjustment-review-items";

// 린터 출력처럼: 문제 항목(✖ 불인정·과다청구 → ⚠ 협의·조사)만 줄 번호와 함께
// 먼저 보여주고, 통과(✔)는 건수만 두고 접어둠. 100항목 건에서 96개 "인정"을
// 다 읽지 않게 하는 게 목적.

const SEVERITY_META: Record<DiagnosticSeverity, { glyph: string; label: string; text: string; chip: string; chipOn: string }> = {
  error: {
    glyph: "✖",
    label: "조정",
    text: "text-red-600",
    chip: "border-red-200 text-red-400 hover:bg-red-50",
    chipOn: "border-red-600 bg-red-600 text-white shadow-[0_4px_10px_-4px_rgba(220,38,38,0.6)]",
  },
  warn: {
    glyph: "⚠",
    label: "확인",
    text: "text-amber-600",
    chip: "border-amber-200 text-amber-500 hover:bg-amber-50",
    chipOn: "border-amber-500 bg-amber-500 text-white shadow-[0_4px_10px_-4px_rgba(245,158,11,0.6)]",
  },
  pass: {
    glyph: "✔",
    label: "통과",
    text: "text-emerald-600",
    chip: "border-emerald-200 text-emerald-500 hover:bg-emerald-50",
    chipOn: "border-emerald-600 bg-emerald-600 text-white shadow-[0_4px_10px_-4px_rgba(5,150,105,0.6)]",
  },
};

function VerdictBadge({ verdict }: { verdict: VerdictLabel }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_1px_3px_-1px_rgba(0,0,0,0.4)] ${VERDICT_STYLES[verdict].badge}`}
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
  diagnostics: AdjustmentDiagnostic[];
  onHoverPhotos: (refs: number[]) => void;
  onOpenPhoto: (photoNo: number) => void;
}) {
  const [shown, setShown] = useState<Set<DiagnosticSeverity>>(new Set(["error", "warn"]));

  const counts = useMemo(() => {
    const c: Record<DiagnosticSeverity, number> = { error: 0, warn: 0, pass: 0 };
    diagnostics.forEach((d) => (c[d.severity] += 1));
    return c;
  }, [diagnostics]);

  const visible = diagnostics.filter((d) => shown.has(d.severity));

  function toggle(sev: DiagnosticSeverity) {
    setShown((cur) => {
      const next = new Set(cur);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 요약바 = 필터 */}
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
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

      <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            {counts.error + counts.warn === 0 ? "조정 필요 항목 없음 — 전 항목 통과" : "선택한 구분에 해당하는 항목이 없습니다."}
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {visible.map((d) => (
              <DiagnosticRow key={d.id} d={d} onHoverPhotos={onHoverPhotos} onOpenPhoto={onOpenPhoto} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DiagnosticRow({
  d,
  onHoverPhotos,
  onOpenPhoto,
}: {
  d: AdjustmentDiagnostic;
  onHoverPhotos: (refs: number[]) => void;
  onOpenPhoto: (photoNo: number) => void;
}) {
  const m = SEVERITY_META[d.severity];
  const muted = d.severity === "pass";

  if (d.kind === "consistency") {
    return (
      <div className="flex gap-3 px-4 py-3">
        <span className={`w-5 shrink-0 text-center text-base font-bold ${m.text}`}>{m.glyph}</span>
        <span className="w-8 shrink-0 text-right font-mono text-xs text-slate-300">--</span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-slate-800">{d.title}</span>
            <VerdictBadge verdict={d.verdict} />
          </div>
          <p className="text-xs leading-relaxed text-slate-600">{d.message}</p>
        </div>
      </div>
    );
  }

  const it = d.item;
  const refs = it.photo_refs;

  return (
    <div
      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${muted ? "opacity-70" : ""}`}
      onMouseEnter={() => onHoverPhotos(refs)}
      onMouseLeave={() => onHoverPhotos([])}
    >
      <span className={`w-5 shrink-0 text-center text-base font-bold ${m.text}`}>{m.glyph}</span>
      <span className="w-8 shrink-0 pt-0.5 text-right font-mono text-xs tabular-nums text-slate-400">{d.lineNo}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-semibold leading-snug text-slate-800">
            {it.item_name}
            <span className="font-normal text-slate-400"> · {it.claimed_action}</span>
            {it.claimed_hours != null && <span className="font-mono text-slate-500"> {it.claimed_hours}H</span>}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {d.damageType && <span className={TYPE_BADGE_CLASS}>{d.damageType}</span>}
            <VerdictBadge verdict={it.verdict} />
          </span>
        </div>
        {!muted && (
          <p className="text-xs leading-relaxed text-slate-600">
            {it.reasoning}
            {it.adjustment_note && <span className="font-semibold text-slate-900"> → {it.adjustment_note}</span>}
          </p>
        )}
        {muted && <p className="text-[11px] leading-relaxed text-slate-400">{it.reasoning}</p>}
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
      </div>
    </div>
  );
}
