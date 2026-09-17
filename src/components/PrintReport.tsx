"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AdjustmentDiagnostics,
  DiagnosticSeverity,
  ItemDiagnostic,
} from "@/lib/adjustment-review-items";
import { isEstimateTree, type EstimateTree } from "@/lib/estimate-tree";
import { judgmentKey } from "@/components/EstimateTree";
import { fmtKst } from "@/lib/kst";

// 손해사정·선견적 공용 인쇄 보고서. 결과는 브라우저 캐시(IndexedDB)에서 읽어 오고
// 서버에는 아무것도 보내지 않는다. 브라우저 인쇄 대화상자에서 "PDF로 저장".

export interface PrintReportProps {
  title: string;
  toolLabel: string;
  accent: "purple" | "blue";
  header: { label: string; value: string }[];
  memo?: string;
  diagnostics: AdjustmentDiagnostics;
  estimateTree?: EstimateTree | null;
  opinion?: string | null; // 선견적 회신문(편집 반영)
  lists?: { label: string; items: string[] }[]; // 선견적 부가 목록
  photos: File[];
  createdAt: number;
}

const SEV_LABEL: Record<DiagnosticSeverity, string> = {
  error: "조정 필요",
  warn: "확인 필요",
  pass: "통과",
};
const SEV_COLOR: Record<DiagnosticSeverity, string> = {
  error: "#dc2626",
  warn: "#d97706",
  pass: "#059669",
};
const VERDICT_COLOR: Record<string, string> = {
  인정: "#059669",
  협의필요: "#d97706",
  과다청구: "#ea580c",
  조사필요: "#0284c7",
  불인정: "#dc2626",
};

const won = (n: number | null | undefined) =>
  n == null ? "" : n.toLocaleString("ko-KR");

export function PrintReport(p: PrintReportProps) {
  const [includePass, setIncludePass] = useState(true);
  const [photoMode, setPhotoMode] = useState<"refs" | "all" | "none">("refs");
  // 사진 미리보기 URL — 사진 목록이 바뀌면 다시 만들고 이전 것은 해제
  const urls = useMemo(
    () => p.photos.map((f) => URL.createObjectURL(f)),
    [p.photos],
  );
  useEffect(() => () => urls.forEach((x) => URL.revokeObjectURL(x)), [urls]);

  // 청구 금액(항목표) — line_no로 붙임
  const amountByLine = useMemo(() => {
    const m = new Map<string, { labor: number | null; part: number | null }>();
    if (isEstimateTree(p.estimateTree))
      for (const r of p.estimateTree.rows)
        m.set(judgmentKey(r.line_no), {
          labor: r.before.labor,
          part: r.before.part,
        });
    return m;
  }, [p.estimateTree]);

  const { branches, counts, consistency } = p.diagnostics;
  const problems = branches.filter((b) => b.severity !== "pass");
  const passed = branches.filter((b) => b.severity === "pass");

  // 근거 사진: 문제 항목이 참조한 사진만(중복 제거, 번호순)
  const refPhotoNos = useMemo(() => {
    const s = new Set<number>();
    for (const b of problems) {
      const rows = [b.main, ...b.children].filter(Boolean) as ItemDiagnostic[];
      for (const r of rows)
        if (r.severity !== "pass") r.view.photoRefs.forEach((n) => s.add(n));
    }
    return [...s]
      .sort((a, b) => a - b)
      .filter((n) => n >= 1 && n <= urls.length);
  }, [problems, urls.length]);
  const photoNos =
    photoMode === "all"
      ? urls.map((_, i) => i + 1)
      : photoMode === "refs"
        ? refPhotoNos
        : [];

  const accent = p.accent === "purple" ? "#7c3aed" : "#2563eb";

  return (
    <div className="print-root mx-auto max-w-[210mm] bg-white px-[12mm] py-[10mm] text-[11px] leading-snug text-slate-900">
      {/* 화면 전용 툴바 */}
      <div className="print-hidden mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 active:scale-95"
        >
          인쇄 / PDF로 저장
        </button>
        <label className="flex items-center gap-1.5 font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={includePass}
            onChange={(e) => setIncludePass(e.target.checked)}
          />
          통과 항목 포함
        </label>
        <span className="flex items-center gap-1.5 font-semibold text-slate-700">
          근거 사진
          {(
            [
              ["refs", `문제 항목 참조분(${refPhotoNos.length}장)`],
              ["all", `전체(${urls.length}장)`],
              ["none", "제외"],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="flex items-center gap-1 font-normal">
              <input
                type="radio"
                name="photoMode"
                checked={photoMode === v}
                onChange={() => setPhotoMode(v)}
              />
              {l}
            </label>
          ))}
        </span>
        <span className="ml-auto text-[11px] text-slate-500">
          인쇄 대화상자에서 대상을 &quot;PDF로 저장&quot;으로 선택. 배경색이 안
          나오면 &quot;배경 그래픽&quot; 옵션을 켜세요.
        </span>
      </div>

      {/* 머리말 */}
      <div
        className="flex items-end justify-between border-b-2 pb-2"
        style={{ borderColor: accent }}
      >
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {p.toolLabel} · AI 보조 의견
          </div>
          <h1 className="text-xl font-black tracking-tight">{p.title}</h1>
        </div>
        <div className="text-right text-[10px] text-slate-500">
          <div>실행 {fmtKst(new Date(p.createdAt))}</div>
          <div>출력 {fmtKst(new Date())}</div>
        </div>
      </div>

      {/* 건 정보 */}
      <div className="mt-3 grid grid-cols-4 gap-x-4 gap-y-1 rounded-lg border border-slate-200 p-2.5">
        {p.header.map((h) => (
          <div key={h.label} className="min-w-0">
            <div className="text-[9px] font-bold text-slate-400">{h.label}</div>
            <div className="truncate font-semibold">{h.value || "-"}</div>
          </div>
        ))}
        {p.memo && (
          <div className="col-span-4">
            <div className="text-[9px] font-bold text-slate-400">
              담당자 메모
            </div>
            <div className="whitespace-pre-wrap">{p.memo}</div>
          </div>
        )}
      </div>

      {/* 요약 */}
      <div className="mt-3 flex items-stretch gap-2">
        {(["error", "warn", "pass"] as DiagnosticSeverity[]).map((s) => (
          <div
            key={s}
            className="flex flex-1 items-center justify-between rounded-lg px-3 py-2 text-white"
            style={{ background: SEV_COLOR[s] }}
          >
            <span className="text-[10px] font-bold">{SEV_LABEL[s]}</span>
            <span className="text-lg font-black tabular-nums">{counts[s]}</span>
          </div>
        ))}
      </div>
      {consistency && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <div className="text-[10px] font-bold text-amber-800">
            ⚠ {consistency.title}
          </div>
          <div className="text-amber-900">{consistency.message}</div>
        </div>
      )}

      {/* 회신문(선견적) */}
      {p.opinion && (
        <section className="mt-4 break-inside-avoid">
          <h2 className="mb-1 text-[12px] font-black">
            종합 의견 (거래처 회신문)
          </h2>
          <div className="whitespace-pre-wrap rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed">
            {p.opinion}
          </div>
        </section>
      )}

      {/* 항목별 판정 */}
      <section className="mt-4">
        <h2 className="mb-1 text-[12px] font-black">
          조정·확인 필요 항목{" "}
          <span className="font-semibold text-slate-400">
            {problems.length}개 부위
          </span>
        </h2>
        {problems.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
            조정이 필요한 항목이 없습니다.
          </div>
        ) : (
          <ItemTable
            branches={problems}
            amountByLine={amountByLine}
            accent={accent}
          />
        )}
      </section>

      {includePass && passed.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-1 text-[12px] font-black">
            통과 항목{" "}
            <span className="font-semibold text-slate-400">
              {passed.length}개 부위 · {counts.pass}건
            </span>
          </h2>
          <ItemTable
            branches={passed}
            amountByLine={amountByLine}
            accent={accent}
            compact
          />
        </section>
      )}

      {p.lists?.map(
        (l) =>
          l.items.length > 0 && (
            <section key={l.label} className="mt-3 break-inside-avoid">
              <h2 className="mb-1 text-[12px] font-black">{l.label}</h2>
              <ul className="list-disc pl-5">
                {l.items.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </section>
          ),
      )}

      {/* 근거 사진 */}
      {photoNos.length > 0 && (
        <section className="mt-4 break-before-page">
          <h2 className="mb-1 text-[12px] font-black">
            근거 사진{" "}
            <span className="font-semibold text-slate-400">
              {photoMode === "all" ? "전체" : "문제 항목 참조분"} ·{" "}
              {photoNos.length}장
            </span>
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {photoNos.map((n) => (
              <figure key={n} className="break-inside-avoid">
                <div className="aspect-[4/3] overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urls[n - 1]}
                    alt={`사진 ${n}`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <figcaption className="mt-0.5 text-center font-mono text-[9px] text-slate-500">
                  #{n}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <div className="print-footer mt-6 border-t border-slate-200 pt-2 text-[9px] text-slate-400">
        이 보고서는 AI가 사진·청구서를 근거로 낸 보조 의견이며 최종 사정은
        담당자가 판단합니다. 결과·사진은 서버에 저장되지 않습니다.
      </div>
    </div>
  );
}

function ItemTable({
  branches,
  amountByLine,
  accent,
  compact = false,
}: {
  branches: AdjustmentDiagnostics["branches"];
  amountByLine: Map<string, { labor: number | null; part: number | null }>;
  accent: string;
  compact?: boolean;
}) {
  return (
    <table className="w-full table-fixed border-collapse text-[10.5px]">
      <colgroup>
        <col style={{ width: "5%" }} />
        <col style={{ width: "28%" }} />
        <col style={{ width: "8%" }} />
        <col style={{ width: "10%" }} />
        <col style={{ width: "40%" }} />
        <col style={{ width: "9%" }} />
      </colgroup>
      <thead>
        <tr className="border-b-2 border-slate-800 text-left text-[9.5px] text-slate-600">
          <th className="py-1 pr-1 text-right">NO</th>
          <th className="py-1 pr-2">항목 · 청구 작업</th>
          <th className="py-1 pr-2 text-right">청구 공임</th>
          <th className="py-1 pr-2">판정</th>
          <th className="py-1">판단 내용</th>
          <th className="py-1 text-right">근거 사진</th>
        </tr>
      </thead>
      <tbody>
        {branches.map((b) => {
          const rows = [b.main, ...b.children].filter(
            Boolean,
          ) as ItemDiagnostic[];
          return rows.map((d, i) => (
            <Row
              key={d.id}
              d={d}
              isMain={i === 0 && !!b.main}
              first={i === 0}
              groupLabel={b.label}
              groupSeverity={b.severity}
              amount={
                d.lineNo != null
                  ? amountByLine.get(judgmentKey(d.lineNo))
                  : undefined
              }
              accent={accent}
              compact={compact}
            />
          ));
        })}
      </tbody>
    </table>
  );
}

function Row({
  d,
  isMain,
  first,
  groupLabel,
  groupSeverity,
  amount,
  accent,
  compact,
}: {
  d: ItemDiagnostic;
  isMain: boolean;
  first: boolean;
  groupLabel: string;
  groupSeverity: DiagnosticSeverity;
  amount?: { labor: number | null; part: number | null };
  accent: string;
  compact: boolean;
}) {
  const it = d.view;
  const follows = it.followsParent && !isMain;
  const color = follows ? "#94a3b8" : (VERDICT_COLOR[it.verdict] ?? "#334155");
  return (
    <>
      {first && (
        <tr className="break-inside-avoid">
          <td
            colSpan={6}
            className="border-t border-slate-300 pt-1.5 pb-0.5 text-[10px] font-black"
            style={{ color: SEV_COLOR[groupSeverity] }}
          >
            ■ {groupLabel}
          </td>
        </tr>
      )}
      <tr className="break-inside-avoid border-b border-slate-100 align-top">
        <td className="py-1 pr-1 text-right font-mono text-slate-400">
          {d.lineNo ?? ""}
        </td>
        <td className="py-1 pr-2">
          <span
            className="mr-1 rounded px-1 py-px text-[8px] font-bold text-white"
            style={{ background: isMain ? accent : "#94a3b8" }}
          >
            {it.roleLabel}
          </span>
          <span className={isMain ? "font-bold" : "font-medium"}>
            {it.itemName}
          </span>
          <span className="text-slate-500"> · {it.claimedAction}</span>
          {it.claimedHours != null && (
            <span className="font-mono text-slate-600">
              {" "}
              {it.claimedHours}H
            </span>
          )}
          {d.damageType && (
            <span className="ml-1 rounded-full border border-slate-300 px-1 py-px text-[8px] font-bold text-slate-600">
              {d.damageType}
            </span>
          )}
        </td>
        <td className="py-1 pr-2 text-right font-mono tabular-nums text-slate-600">
          {won(amount?.labor)}
        </td>
        <td className="py-1 pr-2">
          <span
            className="inline-block rounded-full px-1.5 py-px text-[9px] font-bold text-white"
            style={{ background: color }}
          >
            {follows ? "↳ 연동" : it.verdict}
          </span>
          {!follows && it.basis === "추론" && (
            <span className="ml-0.5 inline-block rounded-full border border-dashed border-violet-400 px-1 py-px text-[8px] font-bold text-violet-700">
              추론
            </span>
          )}
        </td>
        <td className="py-1 leading-snug">
          {follows ? (
            it.note && <span className="text-slate-500">→ {it.note}</span>
          ) : (
            <>
              <span>{it.reasoning}</span>
              {it.note && (
                <span className="font-semibold text-slate-800">
                  {" "}
                  → {it.note}
                </span>
              )}
              {!compact &&
                it.extras.map((x, i) => (
                  <div key={i} className="mt-0.5 text-[9.5px] text-slate-600">
                    <span className="font-bold">[{x.label}]</span> {x.text}
                  </div>
                ))}
              {it.costComparison && (
                <div className="mt-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-1 text-[9.5px]">
                  <div>
                    <b>교환안(청구서)</b> {it.costComparison.replace_option}
                  </div>
                  <div>
                    <b>수리안(추정)</b> {it.costComparison.repair_option}
                  </div>
                  <div>→ {it.costComparison.recommendation}</div>
                </div>
              )}
            </>
          )}
        </td>
        <td className="py-1 text-right font-mono text-[9px] text-slate-500">
          {it.photoRefs.length ? it.photoRefs.join(", ") : ""}
        </td>
      </tr>
    </>
  );
}
