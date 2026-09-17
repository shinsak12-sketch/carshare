"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RateLike } from "@/lib/pricing-defaults";

export function PricingForm({
  model,
  initial,
}: {
  model: string;
  initial: RateLike;
}) {
  const router = useRouter();
  const [v, setV] = useState({ ...initial, note: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [recalcing, setRecalcing] = useState(false);

  // 단가 확정 전에 쌓인 건들을 현재 저장된 단가로 다시 계산
  async function recalc() {
    if (
      !window.confirm(
        "모든 실행 기록의 비용을 현재 저장된 단가로 다시 계산합니다. 계속할까요?",
      )
    )
      return;
    setRecalcing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/pricing/recalc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "재계산 실패");
      setMsg(
        `${data.count}건 재계산 완료 — 합계 ${Number(data.totalKrw).toLocaleString("ko-KR")}원`,
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "재계산 실패");
    } finally {
      setRecalcing(false);
    }
  }

  const field = (key: keyof RateLike, label: string, step: string) => (
    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
      {label}
      <input
        type="number"
        step={step}
        min={0}
        value={v[key]}
        onChange={(e) => setV({ ...v, [key]: Number(e.target.value) })}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal tabular-nums text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
    </label>
  );

  // 예시: 사진 30장 건 대략 입력 40k·출력 6k 토큰일 때 비용 미리보기
  const sample = {
    inputTokens: 40_000,
    cachedInputTokens: 0,
    outputTokens: 6_000,
  };
  const usd =
    (sample.inputTokens * v.inputUsdPerM +
      sample.outputTokens * v.outputUsdPerM) /
    1_000_000;

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, ...v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setMsg("저장됨. 이후 실행부터 적용.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs text-white">
          {model}
        </span>
        <span className="text-xs text-slate-500">현재 적용 단가</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {field("inputUsdPerM", "입력 $/100만 토큰", "0.01")}
        {field("cachedInputUsdPerM", "캐시 입력 $/100만", "0.001")}
        {field("outputUsdPerM", "출력 $/100만 (추론 포함)", "0.01")}
        {field("usdToKrw", "환율 (원/달러)", "1")}
      </div>
      <label className="mt-3 flex flex-col gap-1 text-xs font-semibold text-slate-600">
        변경 메모
        <input
          value={v.note}
          onChange={(e) => setV({ ...v, note: e.target.value })}
          placeholder="예: 2026-09 OpenAI 청구서 기준"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
        >
          {saving ? "저장 중…" : "새 단가로 저장"}
        </button>
        <button
          type="button"
          onClick={recalc}
          disabled={recalcing}
          title="저장된 단가로 기존 실행 기록의 비용을 다시 계산(단가 확정 전 건 정리용)"
          className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {recalcing ? "재계산 중…" : "기존 기록 재계산"}
        </button>
        <span className="text-xs text-slate-500">
          미리보기 — 입력 40k · 출력 6k 토큰 1건 ≈ ${usd.toFixed(3)} ≈{" "}
          {Math.round(usd * v.usdToKrw).toLocaleString("ko-KR")}원
        </span>
        {msg && (
          <span className="text-xs font-semibold text-blue-700">{msg}</span>
        )}
      </div>
    </div>
  );
}
