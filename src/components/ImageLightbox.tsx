"use client";

import { useEffect, useRef, useState } from "react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

export function ImageLightbox({
  urls,
  index,
  onIndexChange,
  onClose,
  labels,
  title,
}: {
  urls: string[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  // 하단 카운터에 붙일 사진 이름(예: "사진 17"). 근거사진 일부만 넘길 때 실제 번호를 보여주기 위함
  labels?: string[];
  // 어떤 묶음을 보고 있는지(예: "리어범퍼 교환 근거사진")
  title?: string;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndexChange((index + 1) % urls.length);
      if (e.key === "ArrowLeft")
        onIndexChange((index - 1 + urls.length) % urls.length);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, urls.length, onIndexChange, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white transition-colors hover:bg-white/20"
      >
        ✕
      </button>

      {urls.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index - 1 + urls.length) % urls.length);
          }}
          className="absolute left-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white transition-colors hover:bg-white/20"
        >
          ‹
        </button>
      )}

      {/* key=index: 사진을 넘기면 확대 상태가 새로 시작(원래 크기) */}
      <ZoomStage
        key={index}
        src={urls[index]}
        alt={`첨부 사진 ${index + 1}`}
        caption={
          <>
            {title && <span className="text-white/70">{title}</span>}
            {labels?.[index] && <span>{labels[index]}</span>}
            {urls.length > 1 && (
              <span className="tabular-nums text-white/80">
                {index + 1} / {urls.length}
              </span>
            )}
          </>
        }
      />

      {urls.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index + 1) % urls.length);
          }}
          className="absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white transition-colors hover:bg-white/20"
        >
          ›
        </button>
      )}
    </div>
  );
}

// 휠 확대(커서 위치 기준) + 확대 상태에서 드래그 이동 + 더블클릭/0 키로 원래 크기
function ZoomStage({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption: React.ReactNode;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);

  function resetZoom() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "0") resetZoom();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // React의 onWheel은 passive라 페이지 스크롤을 못 막음 → 직접 등록
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      // 무대 중심 기준 커서 위치
      const px = e.clientX - rect.left - rect.width / 2;
      const py = e.clientY - rect.top - rect.height / 2;
      setZoom((z) => {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor));
        if (nz === z) return z;
        // 커서 아래 지점이 그대로 있도록 오프셋 보정
        setOffset((o) => {
          if (nz === 1) return { x: 0, y: 0 };
          const k = nz / z;
          return { x: px - (px - o.x) * k, y: py - (py - o.y) * k };
        });
        return nz;
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (zoom === 1) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
      moved: false,
    };
    setDragging(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    setOffset({ x: d.ox + dx, y: d.oy + dy });
  }
  function onPointerUp() {
    // 드래그 직후의 click 이벤트가 닫기로 새지 않도록 moved 표시는 다음 틱까지 유지
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d?.moved) {
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
    }
  }
  const suppressClick = useRef(false);

  return (
    <>
      <div
        ref={stageRef}
        className="flex h-full w-full items-center justify-center overflow-hidden p-6"
        onClick={(e) => {
          if (suppressClick.current) e.stopPropagation();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          cursor: dragging ? "grabbing" : zoom > 1 ? "grab" : "default",
          touchAction: "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[88vh] max-w-[88vw] select-none rounded-lg object-contain shadow-2xl"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transition: dragging ? "none" : "transform 80ms ease-out",
            cursor: dragging ? "grabbing" : zoom > 1 ? "grab" : "zoom-in",
          }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (zoom > 1) resetZoom();
            else setZoom(2.5);
          }}
        />
      </div>

      <div
        className="absolute bottom-6 z-10 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {caption}
        <span className="mx-1 h-3 w-px bg-white/30" />
        <button
          type="button"
          onClick={resetZoom}
          title="원래 크기 (더블클릭 또는 0 키)"
          className={`tabular-nums transition-colors ${
            zoom > 1 ? "text-white hover:text-emerald-300" : "text-white/50"
          }`}
        >
          {Math.round(zoom * 100)}%
        </button>
        <span className="text-white/50">휠 확대 · 드래그 이동</span>
      </div>
    </>
  );
}
