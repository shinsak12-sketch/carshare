"use client";

import { useState } from "react";
import { TYPE_BADGE_CLASS } from "@/lib/review-items";
import type {
  AdjustmentDiagnostics as Diagnostics,
  DiagnosticBranch,
  DiagnosticSeverity,
  ItemDiagnostic,
} from "@/lib/adjustment-review-items";
import {
  CostComparisonCard,
  InferredBadge,
  SEVERITY_META,
  VerdictBadge,
} from "./DiagnosticsPanel";

// [실험] 견적서가 보여주는 순서 그대로 전체 트리를 한 번에 출력.
//   [메인] 6  프런트범퍼 교환 · 교환            [과다청구]
//     └ [부수] 12 후방감지센서 탈착 · 탈착        [인정]
//     └ [도장]  5 리어범퍼 교환도장 · 교환도장    [↳ 연동]
// 판넬 목록→상세 클릭 없이 스크롤만으로 다 본다. 필터 칩은 기본 전부 켜짐.

function branchLine(b: DiagnosticBranch): number {
  const nums = [b.main, ...b.children].map(
    (d) => d?.lineNo ?? Number.MAX_SAFE_INTEGER,
  );
  return Math.min(...nums);
}

export function DiagnosticsTree({
  diagnostics,
  onHoverPhotos,
  onOpenPhoto,
}: {
  diagnostics: Diagnostics;
  onHoverPhotos: (refs: number[]) => void;
  onOpenPhoto: (photoNo: number) => void;
}) {
  const [shown, setShown] = useState<Set<DiagnosticSeverity>>(
    new Set(["error", "warn", "pass"]),
  );
  const [order, setOrder] = useState<"estimate" | "severity">("estimate");
  const { consistency, branches, counts } = diagnostics;

  const visible = branches.filter((b) => shown.has(b.severity));
  const sorted =
    order === "estimate"
      ? [...visible].sort((a, b) => branchLine(a) - branchLine(b))
      : visible;

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
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
        {(["error", "warn", "pass"] as DiagnosticSeverity[]).map((sev) => {
          const m = SEVERITY_META[sev];
          const on = shown.has(sev);
          return (
            <button
              key={sev}
              type="button"
              onClick={() => toggle(sev)}
              className={`flex min-w-[96px] flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold transition-all active:scale-95 ${on ? m.chipOn : `bg-white ${m.chip}`}`}
            >
              <span className="text-base leading-none">{m.glyph}</span>
              <span className="tabular-nums">{counts[sev]}</span>
              <span className="text-[11px] font-semibold opacity-80">
                {m.label}
              </span>
            </button>
          );
        })}
        <div className="ml-auto flex shrink-0 rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold">
          {(
            [
              ["estimate", "견적서 순"],
              ["severity", "심각도 순"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setOrder(k)}
              className={`rounded-md px-2.5 py-1 transition-colors ${order === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {consistency && (
        <div className="flex shrink-0 gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="w-5 shrink-0 text-center text-base font-bold text-amber-600">
            ⚠
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[13px] font-bold text-amber-900">
              {consistency.title}
            </span>
            <p className="text-xs leading-relaxed text-amber-900/80">
              {consistency.message}
            </p>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
        {sorted.length === 0 && (
          <p className="px-3 py-10 text-center text-xs text-slate-400">
            표시할 항목이 없습니다.
          </p>
        )}
        <div className="flex flex-col divide-y divide-slate-100">
          {sorted.map((b) => (
            <Branch
              key={b.id}
              branch={b}
              onHoverPhotos={onHoverPhotos}
              onOpenPhoto={onOpenPhoto}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Branch({
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
    <div className="px-3 py-2">
      {branch.main ? (
        <Row
          d={branch.main}
          isMain
          onHoverPhotos={onHoverPhotos}
          onOpenPhoto={onOpenPhoto}
        />
      ) : (
        <div className="flex items-center gap-2 px-1 py-1">
          <span className={`w-4 text-center text-sm font-bold ${m.text}`}>
            {m.glyph}
          </span>
          <span className="text-[13px] font-bold text-slate-800">
            {branch.label}
          </span>
          <span className="text-[10px] text-slate-400">메인 항목 없음</span>
        </div>
      )}
      {branch.children.length > 0 && (
        <div className="ml-3 mt-1 flex flex-col gap-1 border-l-2 border-slate-200 pl-1">
          {branch.children.map((d) => (
            <div key={d.id} className="flex items-start gap-1">
              <span className="mt-2 shrink-0 font-mono text-[11px] text-slate-300">
                └
              </span>
              <div className="min-w-0 flex-1">
                <Row
                  d={d}
                  onHoverPhotos={onHoverPhotos}
                  onOpenPhoto={onOpenPhoto}
                />
              </div>
            </div>
          ))}
        </div>
      )}
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
  const it = d.view;
  const follows = it.followsParent && !isMain;
  const m = SEVERITY_META[d.severity];
  const refs = it.photoRefs;
  return (
    <div
      className={`flex gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50 ${isMain ? "bg-slate-50/70" : ""}`}
      onMouseEnter={() => onHoverPhotos(refs)}
      onMouseLeave={() => onHoverPhotos([])}
    >
      <span
        className={`w-4 shrink-0 text-center text-sm font-bold ${follows ? "text-slate-300" : m.text}`}
      >
        {follows ? "↳" : m.glyph}
      </span>
      <span className="w-6 shrink-0 pt-0.5 text-right font-mono text-[10px] tabular-nums text-slate-400">
        {d.lineNo ?? ""}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <span
            className={`leading-snug ${isMain ? "text-[13px] font-bold text-slate-900" : "text-xs font-medium text-slate-700"}`}
          >
            <span
              className={`mr-1 rounded px-1 py-px text-[9px] font-bold ${isMain ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}
            >
              {it.roleLabel}
            </span>
            {it.itemName}
            <span className="font-normal text-slate-400">
              {" "}
              · {it.claimedAction}
            </span>
            {it.claimedHours != null && (
              <span className="font-mono text-slate-500">
                {" "}
                {it.claimedHours}H
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {d.damageType && (
              <span className={TYPE_BADGE_CLASS}>{d.damageType}</span>
            )}
            {follows ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                ↳ 연동
              </span>
            ) : (
              <>
                {it.basis === "추론" && <InferredBadge />}
                <VerdictBadge verdict={it.verdict} />
              </>
            )}
          </span>
        </div>
        {follows ? (
          it.note && (
            <p className="text-[11px] leading-relaxed text-slate-500">
              → {it.note}
            </p>
          )
        ) : (
          <p
            className={`text-xs leading-relaxed ${d.severity === "pass" ? "text-slate-400" : "text-slate-600"}`}
          >
            {it.reasoning}
            {it.note && (
              <span className="font-semibold text-slate-900"> → {it.note}</span>
            )}
          </p>
        )}
        {!follows && it.extras.length > 0 && (
          <div className="mt-0.5 flex flex-col gap-1">
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
        {!follows && it.costComparison && (
          <CostComparisonCard c={it.costComparison} />
        )}
        {!follows && (it.evidenceLabel || refs.length > 0) && (
          <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
            {it.evidenceLabel && <span>{it.evidenceLabel}</span>}
            {refs.length > 0 && (
              <>
                <span>{it.evidenceLabel ? "· " : ""}근거사진</span>
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
