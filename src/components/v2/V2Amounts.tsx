"use client";

import {
  RATE_ALL,
  rateFor,
  type AmountSummary,
  type KindRate,
  type LaborRates,
} from "@/lib/adjustment-amounts";
import {
  rateOf,
  type AmountLine,
  type AmountReport,
} from "@/lib/adjustment-amount-report";
import { BTN, BTN_DARK, cx, kindColor, won } from "./ui";

// 금액 요약 띠(청구·AI 사정·삭감·보류) + 금액 상세(작업별 표, 오른쪽에 수가 편집)

const digits = (v: string) => {
  const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function RateInput({
  value,
  placeholder,
  onChange,
  label,
}: {
  value: number | null | undefined;
  placeholder: string;
  onChange: (v: number | null) => void;
  label: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      placeholder={placeholder}
      value={value ? String(value) : ""}
      onChange={(e) => onChange(digits(e.target.value))}
      className="num h-8 w-full rounded-md border border-[#C5CCD6] bg-[#F3F5F7] px-2 text-right text-xs text-gray-900 shadow-[inset_0_1px_2px_rgba(17,24,39,0.12)] outline-none transition-colors placeholder:text-gray-500 focus:border-[#00704A] focus:bg-white"
    />
  );
}

export function V2AmountStrip({
  amounts,
  report,
  overrideCount,
  rates,
  onRatesChange,
  open,
  onToggle,
}: {
  amounts: AmountSummary;
  report: AmountReport | null;
  overrideCount: number;
  rates: LaborRates;
  onRatesChange: (next: LaborRates) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const pendingAmt = report ? report.total.pending : 0;
  const cell = "bg-white px-5 py-3";
  const label = "text-xs font-bold";
  const big = "num mt-0.5 text-2xl font-bold tracking-tight";
  return (
    <section
      aria-label="금액 요약"
      className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-px border-b border-[#D9DEE5] bg-[#D9DEE5]"
    >
      <div className={cell}>
        <div className={cx(label, "text-gray-600")}>청구</div>
        <div className={big}>{won(amounts.claimedTotal)}</div>
        <div className="text-xs text-gray-600">
          공임 <span className="num">{won(report?.laborTotal.claimed)}</span> ·
          재료 <span className="num">{won(report?.materials.claimed)}</span> ·
          부품 <span className="num">{won(amounts.claimedPart)}</span>
        </div>
      </div>
      <div className={cell}>
        <div className={cx(label, "text-[#00704A]")}>AI 사정</div>
        <div className={cx(big, "text-[#00704A]")}>
          {won(amounts.assessedTotal)}
        </div>
        <div
          className={cx(
            "text-xs",
            overrideCount > 0 ? "font-bold text-[#86198F]" : "text-gray-600",
          )}
        >
          담당자 수정 {overrideCount}건 반영
        </div>
      </div>
      <div className={cell}>
        <div className={cx(label, "text-[#B42318]")}>삭감</div>
        <div className={cx(big, "text-[#B42318]")}>
          {won(amounts.cut)}{" "}
          <span className="text-[13px]">
            {rateOf(amounts.cut, amounts.claimedTotal)}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEF1F4] shadow-[inset_0_1px_2px_rgba(17,24,39,0.15)]">
          <div
            className="h-full bg-[#B42318] transition-[width] duration-300"
            style={{ width: `${Math.min(100, amounts.cutRate * 100)}%` }}
          />
        </div>
      </div>
      <div className={cell}>
        <div className={cx(label, "text-[#1D4ED8]")}>보류 · 금액 확인</div>
        <div className={cx(big, "text-[#1D4ED8]")}>
          {won(amounts.held + pendingAmt)}
        </div>
        <div className="text-xs text-gray-600">
          보류 <span className="num">{won(amounts.held)}</span> · 금액 확인{" "}
          {amounts.pendingHours}건
        </div>
      </div>
      <div className={cx(cell, "flex flex-col justify-center gap-1.5")}>
        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
          수가
          <span className="w-24">
            <RateInput
              label="전체 수가(원/H)"
              value={rates[RATE_ALL]}
              placeholder="견적서 금액"
              onChange={(v) => {
                const next = { ...rates };
                if (v) next[RATE_ALL] = v;
                else delete next[RATE_ALL];
                onRatesChange(next);
              }}
            />
          </span>
          <span className="font-medium">원/H</span>
        </label>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={cx(open ? BTN_DARK : BTN, "h-[30px] self-start")}
        >
          {open ? "금액 상세 닫기" : "금액 상세 · 수가 펼치기"}
        </button>
      </div>
    </section>
  );
}

const GRID =
  "grid grid-cols-[minmax(84px,1fr)_32px_92px_92px_88px_52px_84px] items-center gap-x-2.5";

function Line({
  l,
  strong = false,
  dot,
}: {
  l: AmountLine;
  strong?: boolean;
  dot?: string;
}) {
  const hold = l.held + l.pending;
  const cutPct = l.claimed > 0 ? (l.cut / l.claimed) * 100 : 0;
  return (
    <div
      className={cx(
        GRID,
        "border-b border-gray-200 py-1.5 text-[13px]",
        strong ? "bg-gray-50 font-black" : "font-medium",
      )}
    >
      <span className="flex min-w-0 flex-col gap-1 pl-1">
        <span className="flex items-center gap-1.5">
          {dot && (
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: dot }}
            />
          )}
          <span className="truncate">{l.key}</span>
        </span>
        {!strong && (
          <span className="block h-1 overflow-hidden rounded-full bg-[#EEF1F4]">
            <span
              className="block h-full bg-[#B42318]"
              style={{ width: `${cutPct}%` }}
            />
          </span>
        )}
      </span>
      <span className="num text-right text-xs text-gray-600">{l.n}</span>
      <span className="num text-right">{won(l.claimed)}</span>
      <span className="num text-right">{won(l.assessed)}</span>
      <span
        className={cx(
          "num text-right font-bold",
          l.cut > 0 ? "text-[#B42318]" : "text-gray-500",
        )}
      >
        {won(l.cut)}
      </span>
      <span
        className={cx(
          "num text-right text-xs",
          l.cut > 0 ? "text-[#B42318]" : "text-gray-500",
        )}
      >
        {rateOf(l.cut, l.claimed)}%
      </span>
      <span className="num text-right text-xs text-[#1D4ED8]">
        {hold > 0 ? won(hold) : ""}
      </span>
    </div>
  );
}

function Head({ first }: { first: string }) {
  return (
    <div
      className={cx(
        GRID,
        "border-b border-gray-900 pb-1.5 text-xs font-bold text-gray-600",
      )}
    >
      <span className="pl-1">{first}</span>
      <span className="text-right">줄</span>
      <span className="text-right">청구</span>
      <span className="text-right">사정</span>
      <span className="text-right">삭감</span>
      <span className="text-right">율</span>
      <span className="text-right">보류·확인</span>
    </div>
  );
}

export function V2AmountDetail({
  report,
  kindRates,
  rates,
  onRatesChange,
}: {
  report: AmountReport;
  kindRates: KindRate[];
  rates: LaborRates;
  onRatesChange: (next: LaborRates) => void;
}) {
  const r = report;
  const setRate = (key: string, v: number | null) => {
    const next = { ...rates };
    if (v) next[key] = v;
    else delete next[key];
    onRatesChange(next);
  };
  // 수가 적용으로 청구 기준이 얼마나 달라지는지(견적서 공임 − 시간×적용 수가)
  const deltas = kindRates.map((k) => {
    const applied = rateFor(rates, k.kind);
    return applied ? Math.round(k.hours * applied) - k.labor : 0;
  });
  const deltaTotal = deltas.reduce((s, v) => s + v, 0);
  const hasRates = Object.keys(rates).length > 0;
  return (
    <section
      aria-label="금액 상세"
      className="grid gap-x-8 gap-y-5 border-b border-[#D9DEE5] bg-white px-5 py-4 motion-safe:animate-[fadeInUp_.25s_ease-out] xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"
    >
      <div className="flex min-w-0 flex-col gap-4 overflow-x-auto">
        <div className="min-w-[560px]">
          <Head first="공임 · 재료 · 부품" />
          {r.labor.map((l) => (
            <Line key={l.key} l={l} dot={kindColor(l.key)} />
          ))}
          <Line l={r.laborTotal} strong />
          {r.materials.claimed > 0 && <Line l={r.materials} />}
          <Line l={r.parts} />
          <Line l={r.total} strong />
        </div>
        {r.byReason.length > 0 && (
          <div className="min-w-[560px]">
            <Head first="삭감 · 보류 사유" />
            {r.byReason.map((l) => (
              <Line key={l.key} l={l} />
            ))}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[13px] font-black">수가</h3>
          <span className="text-xs text-gray-600">
            견적서 수가는 공임 ÷ 시간으로 역산한 값. 적용 수가를 넣으면 그
            작업의 공임을 시간 × 수가로 다시 계산.
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[420px]">
            <div className="grid grid-cols-[minmax(64px,1fr)_56px_92px_104px_96px] items-center gap-x-2.5 border-b border-gray-900 pb-1.5 text-xs font-bold text-gray-600">
              <span className="pl-1">작업</span>
              <span className="text-right">시간</span>
              <span className="text-right">견적서 수가</span>
              <span className="text-right">적용 수가(원/H)</span>
              <span className="text-right">청구 변화</span>
            </div>
            {kindRates.length === 0 && (
              <p className="py-3 text-xs text-gray-600">
                시간이 적힌 공임 줄이 없어 수가를 계산할 수 없음.
              </p>
            )}
            {kindRates.map((k, i) => {
              const d = deltas[i];
              return (
                <div
                  key={k.kind}
                  className="grid grid-cols-[minmax(64px,1fr)_56px_92px_104px_96px] items-center gap-x-2.5 border-b border-gray-200 py-1.5 text-[13px]"
                >
                  <span className="flex items-center gap-1.5 pl-1 font-bold">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: kindColor(k.kind) }}
                    />
                    {k.kind}
                  </span>
                  <span className="num text-right text-xs text-gray-600">
                    {k.hours}H
                  </span>
                  <span className="num text-right">{won(k.estimateRate)}</span>
                  <RateInput
                    label={`${k.kind} 적용 수가`}
                    value={rates[k.kind]}
                    placeholder={
                      rates[RATE_ALL] ? won(rates[RATE_ALL]) : "견적서"
                    }
                    onChange={(v) => setRate(k.kind, v)}
                  />
                  <span
                    className={cx(
                      "num text-right text-xs font-bold",
                      d < 0
                        ? "text-[#B42318]"
                        : d > 0
                          ? "text-[#1D4ED8]"
                          : "text-gray-500",
                    )}
                  >
                    {d === 0 ? "0" : `${d > 0 ? "+" : "-"}${won(Math.abs(d))}`}
                  </span>
                </div>
              );
            })}
            <div className="grid grid-cols-[minmax(64px,1fr)_56px_92px_104px_96px] items-center gap-x-2.5 bg-gray-50 py-2 text-[13px] font-black">
              <span className="pl-1">전체 일괄</span>
              <span />
              <span />
              <RateInput
                label="전체 일괄 수가"
                value={rates[RATE_ALL]}
                placeholder="견적서"
                onChange={(v) => setRate(RATE_ALL, v)}
              />
              <span
                className={cx(
                  "num text-right text-xs",
                  deltaTotal < 0
                    ? "text-[#B42318]"
                    : deltaTotal > 0
                      ? "text-[#1D4ED8]"
                      : "text-gray-500",
                )}
              >
                {deltaTotal === 0
                  ? "0"
                  : `${deltaTotal > 0 ? "+" : "-"}${won(Math.abs(deltaTotal))}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!hasRates}
            onClick={() => onRatesChange({})}
            className={cx(BTN, "h-8")}
          >
            견적서 수가로 되돌리기
          </button>
          <span className="text-xs text-gray-600">
            작업별 값이 전체 일괄보다 우선. 재료비·부품비는 수가와 무관.
          </span>
        </div>
      </div>
    </section>
  );
}
