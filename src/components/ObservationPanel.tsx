"use client";

import { useState } from "react";
import type { Adjustment2Result } from "@/lib/adjustment2-types";

// v2(adj5.0) 전용: 0단계 사진 목록, 관찰표, 자기검증을 한 패널에.
// 판정이 어느 관찰을 근거로 했는지(items.evidence_ids)와 이어 보게 한다.
const SEV: Record<string, string> = {
  경미: "bg-sky-100 text-sky-800",
  보통: "bg-amber-100 text-amber-800",
  심함: "bg-red-100 text-red-800",
};
const KIND: Record<string, string> = {
  수리전: "bg-red-600 text-white",
  작업중: "bg-amber-500 text-white",
  완료: "bg-emerald-600 text-white",
  "서류·기타": "bg-slate-400 text-white",
};

export function ObservationPanel({
  result,
  onHoverPhotos,
  onOpenPhoto,
}: {
  result: Adjustment2Result;
  onHoverPhotos: (refs: number[]) => void;
  onOpenPhoto: (n: number, refs: number[], title: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [showIndex, setShowIndex] = useState(false);
  const photoIndex = result.photo_index ?? [];
  const obs = result.observations ?? [];
  const checks = result.self_check ?? [];
  // 관찰 ID → 그 관찰을 인용한 항목 수(판정과의 연결 표시)
  const cited = new Map<number, number>();
  for (const it of result.items)
    for (const id of it.evidence_ids ?? [])
      cited.set(id, (cited.get(id) ?? 0) + 1);
  const unusedBefore = photoIndex.filter(
    (p) =>
      p.kind === "수리전" &&
      p.usable &&
      !obs.some((o) => o.photo_refs.includes(p.photo_no)),
  );
  const low = result.items.filter((i) => i.confidence === "낮음").length;

  return (
    <div className="rounded-2xl border border-fuchsia-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(112,26,117,0.35)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-fuchsia-700 px-2 py-0.5 text-[10px] font-bold text-white">
          v2 · 0단계
        </span>
        <span className="text-sm font-bold text-slate-900">
          사진 목록 · 관찰표 · 자기검증
        </span>
        <span className="text-[11px] text-slate-500">
          사진 {photoIndex.length} · 관찰 {obs.length} · 모순 수정{" "}
          {checks.length} · 확신 낮음 {low}
        </span>
        {unusedBefore.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            관찰에 안 쓰인 수리전 사진{" "}
            {unusedBefore.map((p) => p.photo_no).join(", ")}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto rounded-full border border-slate-300 px-3 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
        >
          {open ? "접기 ▲" : "펼치기 ▾"}
        </button>
      </div>

      {open && (
        <div className="mt-3 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* 관찰표 */}
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              관찰표 (판단 없음 · 수리 전 사진에서 보이는 것)
            </div>
            {obs.length === 0 ? (
              <p className="text-xs text-slate-400">관찰 없음</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-slate-400">
                    <th className="py-1 pr-2 text-left font-semibold">#</th>
                    <th className="py-1 pr-2 text-left font-semibold">부위</th>
                    <th className="py-1 pr-2 text-left font-semibold">손상</th>
                    <th className="py-1 pr-2 text-left font-semibold">정도</th>
                    <th className="py-1 pr-2 text-left font-semibold">사진</th>
                    <th className="py-1 text-right font-semibold">인용</th>
                  </tr>
                </thead>
                <tbody>
                  {obs.map((o) => (
                    <tr
                      key={o.id}
                      onMouseEnter={() => onHoverPhotos(o.photo_refs)}
                      onMouseLeave={() => onHoverPhotos([])}
                      className="border-t border-slate-100 align-top hover:bg-fuchsia-50/60"
                    >
                      <td className="py-1.5 pr-2 font-mono font-bold text-fuchsia-700">
                        #{o.id}
                      </td>
                      <td className="py-1.5 pr-2 font-semibold text-slate-900">
                        {o.part_name}
                      </td>
                      <td className="py-1.5 pr-2 text-slate-700">
                        {o.damage_kind}
                      </td>
                      <td className="py-1.5 pr-2">
                        <span
                          className={`rounded-full px-1.5 py-px text-[10px] font-bold ${SEV[o.severity] ?? ""}`}
                        >
                          {o.severity}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2">
                        <span className="inline-flex flex-wrap gap-0.5">
                          {o.photo_refs.map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() =>
                                onOpenPhoto(
                                  n,
                                  o.photo_refs,
                                  `관찰 #${o.id} ${o.part_name}`,
                                )
                              }
                              className="rounded bg-slate-100 px-1 font-mono text-[10px] font-bold text-slate-600 hover:bg-fuchsia-100 hover:text-fuchsia-800"
                            >
                              {n}
                            </button>
                          ))}
                        </span>
                      </td>
                      <td className="py-1.5 text-right font-mono text-[10px] text-slate-500">
                        {cited.get(o.id) ? (
                          `${cited.get(o.id)}건`
                        ) : (
                          <span className="text-amber-600">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {/* 자기검증 */}
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                자기검증 (모델이 스스로 찾아 고친 모순)
              </div>
              {checks.length === 0 ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  모순 없음
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {checks.map((c, i) => (
                    <li
                      key={i}
                      className="rounded-lg bg-amber-50 px-3 py-2 text-xs ring-1 ring-inset ring-amber-200"
                    >
                      <div className="font-semibold text-amber-900">
                        {c.issue}
                      </div>
                      <div className="mt-0.5 text-amber-800">→ {c.fixed}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 사진 목록 */}
            <div>
              <button
                type="button"
                onClick={() => setShowIndex((v) => !v)}
                className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 hover:text-slate-700"
              >
                사진 목록 {showIndex ? "▲" : "▾"}
              </button>
              {showIndex && (
                <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
                  {photoIndex.map((p) => (
                    <li
                      key={p.photo_no}
                      onMouseEnter={() => onHoverPhotos([p.photo_no])}
                      onMouseLeave={() => onHoverPhotos([])}
                      className={`flex items-center gap-2 rounded px-1.5 py-0.5 text-[11px] ${p.usable ? "" : "opacity-50"}`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPhoto(
                            p.photo_no,
                            [p.photo_no],
                            `사진 ${p.photo_no}`,
                          )
                        }
                        className="font-mono font-bold text-slate-600 hover:text-fuchsia-700"
                      >
                        {p.photo_no}
                      </button>
                      <span
                        className={`rounded px-1 text-[9px] font-bold ${KIND[p.kind] ?? ""}`}
                      >
                        {p.kind}
                      </span>
                      <span className="truncate text-slate-700">{p.view}</span>
                      {!p.usable && (
                        <span className="text-[9px] text-red-600">
                          판독불가
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
