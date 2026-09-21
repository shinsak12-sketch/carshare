"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtKst } from "@/lib/kst";
import { CLASS_HEX, DamageLayerDiagram } from "@/components/MinorVisuals";
import { minorPartHeading } from "@/lib/format-minor-report";
import { MINOR_CLASS_LABEL, type MinorResult } from "@/lib/minor-types";

// 경미손상판독 인쇄 보고서(A4). 결과는 브라우저 캐시에서 읽고 서버에는 보내지 않는다.

const STATUS_COLOR: Record<string, string> = {
  해당: "#dc2626",
  "해당 없음": "#94a3b8",
  "확인 불가": "#d97706",
};

export function MinorReport(p: {
  header: { label: string; value: string }[];
  memo?: string;
  result: MinorResult;
  photos: File[];
  createdAt: number;
}) {
  const [photoMode, setPhotoMode] = useState<"refs" | "all" | "none">("refs");
  const urls = useMemo(
    () => p.photos.map((f) => URL.createObjectURL(f)),
    [p.photos],
  );
  useEffect(() => () => urls.forEach((x) => URL.revokeObjectURL(x)), [urls]);

  const refPhotoNos = useMemo(() => {
    const s = new Set<number>();
    for (const part of p.result.parts) {
      part.photo_refs.forEach((n) => s.add(n));
      for (const o of part.observations) o.photo_refs.forEach((n) => s.add(n));
    }
    return [...s]
      .sort((a, b) => a - b)
      .filter((n) => n >= 1 && n <= urls.length);
  }, [p.result, urls.length]);
  const photoNos =
    photoMode === "all"
      ? urls.map((_, i) => i + 1)
      : photoMode === "refs"
        ? refPhotoNos
        : [];

  const accent = "#059669";

  return (
    <div className="print-root mx-auto max-w-[210mm] bg-white px-[12mm] py-[10mm] text-[11px] leading-snug text-slate-900">
      <div className="print-hidden mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 active:scale-95"
        >
          인쇄 / PDF로 저장
        </button>
        <span className="flex items-center gap-1.5 font-semibold text-slate-700">
          사진
          {(
            [
              ["refs", `참조분(${refPhotoNos.length}장)`],
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

      <div
        className="flex items-end justify-between border-b-2 pb-2"
        style={{ borderColor: accent }}
      >
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            경미손상판독 · AI 보조 의견
          </div>
          <h1 className="text-xl font-black tracking-tight">
            경미손상 판독 결과서
          </h1>
        </div>
        <div className="text-right text-[10px] text-slate-500">
          <div>실행 {fmtKst(new Date(p.createdAt))}</div>
          <div>출력 {fmtKst(new Date())}</div>
        </div>
      </div>

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

      {/* 요약표 */}
      <table className="mt-3 w-full border-collapse text-[10.5px]">
        <thead>
          <tr className="border-b-2 border-slate-300 text-left text-[9px] font-bold uppercase text-slate-500">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">부위</th>
            <th className="py-1 pr-2">손상유형</th>
            <th className="py-1 pr-2">교환조건 해당</th>
            <th className="py-1">기준상 수리방법</th>
          </tr>
        </thead>
        <tbody>
          {p.result.parts.map((part, i) => {
            const hit = part.exchange_conditions.filter(
              (c) => c.status === "해당",
            );
            return (
              <tr
                key={i}
                className="break-inside-avoid border-b border-slate-100 align-top"
              >
                <td className="py-1 pr-2 font-mono text-slate-400">{i + 1}</td>
                <td className="py-1 pr-2 font-bold">
                  {minorPartHeading(part)}
                </td>
                <td className="py-1 pr-2">
                  <span
                    className="inline-block rounded-full px-1.5 py-px text-[9px] font-bold text-white"
                    style={{ background: CLASS_HEX[part.classification] }}
                  >
                    {MINOR_CLASS_LABEL[part.classification]}
                  </span>
                </td>
                <td className="py-1 pr-2">
                  {hit.length ? hit.map((c) => c.condition).join(", ") : "없음"}
                </td>
                <td className="py-1">{part.repair_method}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {p.result.vehicle_note && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          <b>차량·사진 메모</b> {p.result.vehicle_note}
        </div>
      )}

      {/* 부위별 상세 */}
      {p.result.parts.map((part, i) => (
        <section
          key={i}
          className="mt-4 break-inside-avoid rounded-lg border border-slate-200 p-3"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
            <div className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white"
                style={{ background: accent }}
              >
                {i + 1}
              </span>
              <span className="text-[13px] font-black">
                {minorPartHeading(part)}
              </span>
              <span
                className="rounded-full px-2 py-px text-[9px] font-bold text-white"
                style={{ background: CLASS_HEX[part.classification] }}
              >
                {MINOR_CLASS_LABEL[part.classification]}
              </span>
              <span className="text-[9px] text-slate-500">
                근거 확신 {part.evidence_confidence}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {part.photo_refs.length > 0 && (
                <span className="font-mono text-[9px] text-slate-500">
                  사진 {part.photo_refs.join(", ")}
                </span>
              )}
              <DamageLayerDiagram cls={part.classification} compact />
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[9px] font-bold text-slate-400">
                사진에서 보이는 것
              </div>
              <ul className="mt-0.5 list-disc pl-3.5">
                {part.observations.map((o, j) => (
                  <li key={j}>
                    <b>{o.what}</b> · {o.location}
                    {o.photo_refs.length > 0 && (
                      <span className="font-mono text-[9px] text-slate-500">
                        {" "}
                        [{o.photo_refs.join(", ")}]
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-1.5 text-[9px] font-bold text-slate-400">
                판정 근거
              </div>
              <div className="font-semibold">{part.key_evidence}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400">
                교환 조건 대조
              </div>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {part.exchange_conditions.map((c, j) => (
                  <li key={j} className="flex items-start gap-1.5">
                    <span
                      className="mt-px shrink-0 rounded px-1 py-px text-[8px] font-bold text-white"
                      style={{ background: STATUS_COLOR[c.status] }}
                    >
                      {c.status}
                    </span>
                    <span>
                      <span
                        className={
                          c.status === "해당" ? "font-bold" : "font-medium"
                        }
                      >
                        {c.condition}
                      </span>
                      {c.note && (
                        <span className="text-slate-500"> — {c.note}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5">
            <b>기준상 수리방법</b> {part.repair_method}
          </div>
          {part.additional_photos.length > 0 && (
            <div className="mt-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
              <b>추가 확인 필요</b> {part.additional_photos.join(", ")}
            </div>
          )}
          <div className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-white">
            <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
              회신문
            </div>
            <div className="mt-0.5 whitespace-pre-line leading-relaxed">
              {part.report_text}
            </div>
          </div>
        </section>
      ))}

      {/* 사진 */}
      {photoNos.length > 0 && (
        <section className="mt-4">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            사진 ({photoNos.length}장)
          </div>
          <div className="grid grid-cols-3 gap-2">
            {photoNos.map((n) => (
              <figure
                key={n}
                className="break-inside-avoid overflow-hidden rounded-lg border border-slate-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urls[n - 1]}
                  alt={`사진 ${n}`}
                  className="aspect-[4/3] w-full object-cover"
                />
                <figcaption className="px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
                  {n}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-5 border-t border-slate-200 pt-2 text-[9px] leading-relaxed text-slate-500">
        근거: 자동차보험 표준약관 제21조 제4항 및 별표 2, 보험개발원
        자동차기술연구소 「경미손상 수리기준」(범퍼 2016.7.1, 후드·펜더·도어·
        트렁크리드·백도어 2019.5.1 책임개시 계약부터). 본 결과는 사진에 근거한
        AI 보조 의견이며 최종 판단은 담당자가 합니다.
      </footer>
    </div>
  );
}
