"use client";

import { useEffect, useState } from "react";

// 세 도구 공용 사진 그리드. 9칸 고정(최소 2줄), 번호 배지, 근거사진 강조/흐림,
// 호버 확대는 제자리 scale이 아니라 화면 최상단(fixed) 레이어에 띄움 —
// 스크롤 컨테이너나 틀 고정 헤더에 잘리지 않음. 확대 레이어는 마우스 이벤트를
// 안 받아서 커서 위치는 원본 칸 기준(옆 칸으로 옮기면 그 칸이 바로 확대).

export type PhotoAccent = "purple" | "blue" | "orange";

const ACCENT: Record<PhotoAccent, { ring: string; badge: string }> = {
  purple: {
    ring: "border-purple-500 ring-4 ring-purple-400/60 shadow-[0_0_0_2px_white,0_8px_20px_-6px_rgba(147,51,234,0.7)]",
    badge: "bg-purple-600 text-white",
  },
  blue: {
    ring: "border-blue-500 ring-4 ring-blue-400/60 shadow-[0_0_0_2px_white,0_8px_20px_-6px_rgba(37,99,235,0.7)]",
    badge: "bg-blue-600 text-white",
  },
  orange: {
    ring: "border-orange-500 ring-4 ring-orange-400/60 shadow-[0_0_0_2px_white,0_8px_20px_-6px_rgba(234,88,12,0.7)]",
    badge: "bg-orange-600 text-white",
  },
};

const PREVIEW = 440; // 확대 크기(px, 정사각 박스 안에 contain)

export function PhotoGrid({
  previews,
  label,
  highlighted,
  accent,
  onOpen,
}: {
  previews: { url: string }[];
  label: string;
  highlighted: number[]; // 1부터
  accent: PhotoAccent;
  onOpen: (index: number) => void;
}) {
  const [hover, setHover] = useState<{
    index: number;
    left: number;
    top: number;
  } | null>(null);
  const a = ACCENT[accent];

  // 스크롤·리사이즈하면 위치가 어긋나니 그냥 닫음
  useEffect(() => {
    if (!hover) return;
    const close = () => setHover(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [hover]);

  function enter(e: React.MouseEvent<HTMLElement>, index: number) {
    const r = e.currentTarget.getBoundingClientRect();
    const margin = 12;
    // 원본 칸 오른쪽 아래로 펼치되 화면 밖으로 나가면 반대편/안쪽으로 밀어넣음
    let left = r.left;
    let top = r.top;
    if (left + PREVIEW + margin > window.innerWidth)
      left = Math.max(margin, r.right - PREVIEW);
    if (top + PREVIEW + margin > window.innerHeight)
      top = Math.max(margin, window.innerHeight - PREVIEW - margin);
    setHover({ index, left, top });
  }

  const cells = Math.max(18, Math.ceil(previews.length / 9) * 9);

  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {label} ({previews.length})
      </p>
      <div className="grid grid-cols-9 gap-2">
        {Array.from({ length: cells }).map((_, i) => {
          const p = previews[i];
          if (!p) {
            return (
              <div
                key={i}
                className="aspect-square rounded-lg border border-dashed border-slate-200 bg-slate-50/50"
              />
            );
          }
          const isHl = highlighted.includes(i + 1);
          const dimmed = highlighted.length > 0 && !isHl;
          return (
            <div key={i} className="relative aspect-square">
              <button
                type="button"
                onClick={() => onOpen(i)}
                onMouseEnter={(e) => enter(e, i)}
                onMouseLeave={() =>
                  setHover((h) => (h?.index === i ? null : h))
                }
                className="absolute inset-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={`${label} ${i + 1}`}
                  className={`pointer-events-none h-full w-full rounded-lg border object-cover transition-all duration-150 ${
                    isHl ? a.ring : "border-slate-200"
                  } ${dimmed ? "opacity-35" : ""} ${hover?.index === i ? "opacity-100 ring-2 ring-slate-900/60" : ""}`}
                />
              </button>
              <span
                className={`pointer-events-none absolute left-1 top-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none shadow-sm transition-colors ${
                  isHl ? a.badge : "bg-white/85 text-slate-600"
                }`}
              >
                {i + 1}
              </span>
            </div>
          );
        })}
      </div>

      {hover && previews[hover.index] && (
        <div
          className="pointer-events-none fixed z-[100] overflow-hidden rounded-xl border border-white/80 bg-slate-900/95 shadow-[0_30px_60px_-12px_rgba(15,23,42,0.6)] backdrop-blur"
          style={{
            left: hover.left,
            top: hover.top,
            width: PREVIEW,
            height: PREVIEW,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previews[hover.index].url}
            alt=""
            className="h-full w-full object-contain"
          />
          <span className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-2 py-1 font-mono text-xs font-bold text-white">
            {hover.index + 1}
          </span>
        </div>
      )}
    </div>
  );
}
