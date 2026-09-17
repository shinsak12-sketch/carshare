"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MODEL_CATALOG,
  TIER_LABEL,
  isReasoningModel,
  type ModelTier,
} from "@/lib/model-catalog";

interface RateView {
  inputUsdPerM: number;
  cachedInputUsdPerM: number;
  outputUsdPerM: number;
  usdToKrw: number;
  fromDb: boolean;
}
interface UsageView {
  runs: number;
  costKrw: number;
  avgIn: number;
  avgOut: number;
}

// 비용 미리보기 기준: 실측한 선견적 1건(사진 7장 + 견적서) 입력 23.2k·출력 11.7k.
// 비추론형은 추론 토큰이 없어 출력을 1/3 수준으로 잡음(JSON 본문만).
const SAMPLE_IN = 23_200;
const SAMPLE_OUT_REASONING = 11_700;
const SAMPLE_OUT_PLAIN = 4_000;

const TIER_TONE: Record<ModelTier, string> = {
  top: "bg-slate-900 text-white",
  standard: "bg-blue-100 text-blue-900",
  economy: "bg-emerald-100 text-emerald-900",
};

function estimate(id: string, r: RateView) {
  const out = isReasoningModel(id) ? SAMPLE_OUT_REASONING : SAMPLE_OUT_PLAIN;
  const usd = (SAMPLE_IN * r.inputUsdPerM + out * r.outputUsdPerM) / 1_000_000;
  return { usd, krw: Math.round(usd * r.usdToKrw) };
}

export function ModelPicker({
  current,
  rates,
  usage,
  extraIds,
}: {
  current: string;
  rates: Record<string, RateView>;
  usage: Record<string, UsageView>;
  extraIds: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const target = custom.trim() || selected;
  const base = rates[current];
  const baseCost = base ? estimate(current, base) : null;

  async function save() {
    if (target === current) {
      setMsg("이미 적용 중인 모델입니다.");
      return;
    }
    if (
      !window.confirm(
        `AI 모델을 ${current} → ${target} 로 바꿉니다. 이후 실행부터 적용됩니다. 계속할까요?`,
      )
    )
      return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setMsg(`적용됨: ${data.model}`);
      setCustom("");
      setSelected(data.model);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  const cards = [
    ...MODEL_CATALOG,
    ...extraIds.map((id) => ({
      id,
      label: id,
      tier: "standard" as ModelTier,
      reasoning: isReasoningModel(id),
      verified: false,
      note: "직접 입력한 모델. 단가는 카탈로그 기본값이니 단가 화면에서 확인.",
    })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((m) => {
          const r = rates[m.id];
          const cost = r ? estimate(m.id, r) : null;
          const u = usage[m.id];
          const active = m.id === current;
          const picked = m.id === selected && !custom.trim();
          const ratio =
            cost && baseCost && baseCost.usd > 0
              ? cost.usd / baseCost.usd
              : null;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setSelected(m.id);
                setCustom("");
              }}
              className={`group relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.99] ${
                picked
                  ? "border-blue-500 bg-blue-50/40 shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
                  : "border-slate-200 bg-white shadow-sm hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
                    picked
                      ? "border-blue-600 bg-blue-600"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {picked && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
                <span className="text-base font-bold text-slate-900">
                  {m.label}
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${TIER_TONE[m.tier]}`}
                >
                  {TIER_LABEL[m.tier]}
                </span>
                {m.reasoning ? (
                  <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-900">
                    추론형
                  </span>
                ) : (
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                    비추론
                  </span>
                )}
                {active && (
                  <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    적용 중
                  </span>
                )}
              </div>
              <div className="font-mono text-[11px] text-slate-500">{m.id}</div>
              <p className="text-xs leading-relaxed text-slate-600">{m.note}</p>
              {r && cost && (
                <div className="mt-1 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600 ring-1 ring-inset ring-slate-200/70">
                  <div>
                    <div className="text-[10px] text-slate-400">입력 $/M</div>
                    <div className="font-semibold tabular-nums text-slate-800">
                      {r.inputUsdPerM}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">출력 $/M</div>
                    <div className="font-semibold tabular-nums text-slate-800">
                      {r.outputUsdPerM}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">1건 예상</div>
                    <div className="font-semibold tabular-nums text-slate-800">
                      {cost.krw.toLocaleString("ko-KR")}원
                      {ratio != null && !active && (
                        <span
                          className={`ml-1 ${ratio < 1 ? "text-emerald-700" : "text-red-700"}`}
                        >
                          ×{ratio.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-3 flex flex-wrap gap-x-3 text-[10px] text-slate-400">
                    <span>
                      {r.fromDb ? "단가: 관리자 저장값" : "단가: 예측치"}
                      {!m.verified && " · 청구서 미확인"}
                    </span>
                    {u && (
                      <span>
                        누적 {u.runs}건 · {u.costKrw.toLocaleString("ko-KR")}원
                        · 평균 입력 {Math.round(u.avgIn / 1000)}k / 출력{" "}
                        {Math.round(u.avgOut / 1000)}k
                      </span>
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          목록에 없는 모델 ID 직접 입력
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="예: gpt-5-nano"
            spellCheck={false}
            className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <span className="font-normal text-slate-400">
            사진 입력과 구조화 출력(json_schema)을 지원하는 OpenAI 모델이어야
            합니다. 이름이 gpt-5·o로 시작하면 추론형으로 취급합니다. 단가는 저장
            후 단가 화면에서 등록.
          </span>
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || target === current}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {saving ? "적용 중…" : `${target} 로 변경`}
          </button>
          <Link
            href={`/admin/pricing?model=${encodeURIComponent(target)}`}
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            이 모델 단가 보기
          </Link>
          {msg && (
            <span className="text-xs font-semibold text-blue-700">{msg}</span>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          1건 예상은 실측 선견적 1건(사진 7장·견적서, 입력 23.2k·출력 11.7k)
          기준. 비추론형은 추론 토큰이 없어 출력 4k로 잡음. 모델을 낮추면 비용은
          줄지만 미세 손상 판독·단계적 판단 품질이 떨어질 수 있으니 바꾼 뒤
          결과를 몇 건 비교해 보세요.
        </p>
      </div>
    </div>
  );
}
