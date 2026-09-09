"use client";

import { useEffect } from "react";

export function ImageLightbox({
  urls,
  index,
  onIndexChange,
  onClose,
}: {
  urls: string[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndexChange((index + 1) % urls.length);
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + urls.length) % urls.length);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, urls.length, onIndexChange, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white transition-colors hover:bg-white/20"
      >
        ✕
      </button>

      {urls.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index - 1 + urls.length) % urls.length);
          }}
          className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white transition-colors hover:bg-white/20"
        >
          ‹
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[index]}
        alt={`첨부 사진 ${index + 1}`}
        className="max-h-[88vh] max-w-[88vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {urls.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index + 1) % urls.length);
          }}
          className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white transition-colors hover:bg-white/20"
        >
          ›
        </button>
      )}

      {urls.length > 1 && (
        <div className="absolute bottom-6 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
          {index + 1} / {urls.length}
        </div>
      )}
    </div>
  );
}
