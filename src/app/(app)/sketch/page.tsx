"use client";

import { useEffect, useRef } from "react";
import { mountSketchEditor } from "@/lib/sketch-editor";

// 약도그림판 — 사고 약도를 도로·차량·표시 부품으로 그려 PNG로 저장. AI 호출 없음, 서버 저장 없음.
export default function SketchPage() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return mountSketchEditor(ref.current);
  }, []);
  return <div ref={ref} className="h-[calc(100dvh-57px)] overflow-hidden" />;
}
