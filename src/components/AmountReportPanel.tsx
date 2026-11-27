"use client";

import {
  rateOf,
  type AmountLine,
  type AmountReport,
  type CutItem,
} from "@/lib/adjustment-amount-report";

// 금액 상세 보고 — 청구·사정·삭감을 공임(작업 종류별) / 도장 재료 / 부품으로 나눠 보여줌.
// 요약 줄의 "금액 상세" 버튼으로 펼침. 값은 담당자 수정이 반영된 현재 화면 기준.

const won = (n: number) => n.toLocaleString("ko-KR");

const KIND_DOT: Record<string, string> = {
  교환: "bg-rose-600",
  탈착: "bg-slate-700",
  판금: "bg-orange-600",
  수리: "bg-amber-500",
  교정: "bg-teal-600",
  도장: "bg-sky-600",
};

// 청구액 대비 사정(회색)·삭감(빨강)·보류(호박) 비율 막대
function Bar({ l, max }: { l: AmountLine; max: number }) {
  if (max <= 0 || l.claimed <= 0) return <span className="block h-2" />;
  const w = (l.claimed / max) * 100;
  const cut = (l.cut / l.claimed) * 100;
  const hold = ((l.held + l.pending) / l.claimed) * 100;
  return (
    <span
      className="block h-2 overflow-hidden rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)]"
      style={{ width: `${Math.max(6, w)}%` }}
    >
      <span className="flex h-full w-full">
        <span
          className="h-full bg-slate-400/70"
          style={{ width: `${Math.max(0, 100 - cut - hold)}%` }}
        />
        <span className="h-full bg-amber-400" style={{ width: `${hold}%` }} />
        <span className="h-full bg-red-500" style={{ width: `${cut}%` }} />
      </span>
    </span>
  );
}

const GRID =
  "grid grid-cols-[minmax(5.5rem,1.1fr)_2.25rem_minmax(5rem,1fr)_minmax(5rem,1fr)_minmax(5rem,1fr)_3.25rem_minmax(4.5rem,0.9fr)] items-center gap-x-2";

function Line({
  l,
  max,
  strong = false,
  dot,
  indent = false,
}: {
  l: AmountLine;
  max: number;
  strong?: boolean;
  dot?: string;
  indent?: boolean;
}) {
  const hold = l.held + l.pending;
  return (
    <div
      className={`${GRID} px-3 py-1.5 ${strong ? "bg-slate-50 font-bold" : ""}`}
    >
      <span
        className={`flex min-w-0 items-center gap-1.5 text-xs ${strong ? "text-slate-900" : "text-slate-700"} ${indent ? "pl-3" : ""}`}
      >
        {dot && (
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${dot}`}
            aria-hidden
          />
        )}
        <span className="truncate">{l.key}</span>
      </span>
      <span className="text-right font-mono text-[10px] tabular-nums text-slate-400">
        {l.n}
      </span>
      <span className="text-right font-mono text-[11px] tabular-nums text-slate-800">
        {won(l.claimed)}
      </span>
      <span className="text-right font-mono text-[11px] tabular-nums text-fuchsia-800">
        {won(l.assessed)}
      </span>
      <span
        className={`text-right font-mono text-[11px] tabular-nums ${l.cut > 0 ? "text-red-600" : "text-slate-300"}`}
      >
        {l.cut > 0 ? `-${won(l.cut)}` : "0"}
      </span>
      <span
        className={`text-right font-mono text-[10px] tabular-nums ${l.cut > 0 ? "text-red-500" : "text-slate-300"}`}
      >
        {rateOf(l.cut, l.claimed)}%
      </span>
      <span className="flex flex-col items-end gap-0.5">
        {hold > 0 ? (
          <span className="font-mono text-[10px] tabular-nums text-amber-600">
            {won(hold)}
          </span>
        ) : (
          <span className="text-[10px] text-slate-300">—</span>
        )}
        {!strong && <Bar l={l} max={max} />}
      </span>
    </div>
  );
}

function Head() {
  return (
    <div
      className={`${GRID} border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400`}
    >
      <span>구분</span>
      <span className="text-right">줄</span>
      <span className="text-right">청구</span>
      <span className="text-right text-fuchsia-700">사정</span>
      <span className="text-right text-red-500">삭감</span>
      <span className="text-right text-red-500">율</span>
      <span className="text-right text-amber-600">보류·확인</span>
    </div>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_8px_20px_-14px_rgba(15,23,42,0.35)]">
      <div className="flex items-baseline gap-2 border-b border-slate-100 px-3 py-2">
        <span className="text-xs font-bold text-slate-900">{title}</span>
        {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Items({ items, tone }: { items: CutItem[]; tone: "cut" | "hold" }) {
  if (items.length === 0)
    return <p className="px-3 py-3 text-[11px] text-slate-400">해당 없음</p>;
  return (
    <div className="flex flex-col divide-y divide-slate-100">
      {items.map((x) => (
        <div
          key={`${x.no}-${x.name}`}
          className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-2 px-3 py-1.5"
        >
          <span className="text-right font-mono text-[10px] tabular-nums text-slate-400">
            {x.no}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs text-slate-800">
              <span className="mr-1 rounded bg-slate-100 px-1 py-px text-[9px] font-bold text-slate-600">
                {x.kind}
              </span>
              {x.name}
            </span>
            {x.reason && (
              <span className="block truncate text-[10px] text-slate-500">
                {x.reason}
              </span>
            )}
          </span>
          <span className="flex flex-col items-end leading-tight">
            <span
              className={`font-mono text-[11px] font-bold tabular-nums ${tone === "cut" ? "text-red-600" : "text-amber-600"}`}
            >
              {tone === "cut" ? `-${won(x.cut)}` : won(x.claimed)}
            </span>
            {tone === "cut" && (
              <span className="font-mono text-[9px] tabular-nums text-slate-400">
                {won(x.claimed)} → {won(x.assessed)}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AmountReportPanel({ report }: { report: AmountReport }) {
  const r = report;
  const laborMax = Math.max(1, ...r.labor.map((l) => l.claimed));
  const reasonMax = Math.max(1, ...r.byReason.map((l) => l.claimed));
  const groupMax = Math.max(1, ...r.byGroup.map((l) => l.claimed));
  const hasMaterials = r.materials.claimed > 0;
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-4 motion-safe:animate-[fadeInUp_.25s_ease-out]">
      <div className="grid gap-3 xl:grid-cols-2">
        <Card title="공임" hint="작업 종류별 순공임 · 도장 재료비는 아래 따로">
          <Head />
          <div className="divide-y divide-slate-100">
            {r.labor.map((l) => (
              <Line
                key={l.key}
                l={l}
                max={laborMax}
                dot={KIND_DOT[l.key] ?? "bg-slate-400"}
              />
            ))}
            <Line l={r.laborTotal} max={0} strong />
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          <Card
            title="부품 · 재료"
            hint="부품은 같은 부위 메인 항목 판정에 연동"
          >
            <Head />
            <div className="divide-y divide-slate-100">
              <Line l={r.parts} max={0} strong />
              {r.partsByStatus.map((l) => (
                <Line
                  key={l.key}
                  l={{ ...l, key: `부품 · ${l.key || "미판정"}` }}
                  max={r.parts.claimed}
                  indent
                />
              ))}
              {hasMaterials && <Line l={r.materials} max={0} strong />}
            </div>
          </Card>
          <Card title="합계">
            <Head />
            <div className="divide-y divide-slate-100">
              <Line l={r.laborTotal} max={r.total.claimed} />
              {hasMaterials && <Line l={r.materials} max={r.total.claimed} />}
              <Line l={r.parts} max={r.total.claimed} />
              <Line l={r.total} max={0} strong />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card title="삭감 · 보류 사유별" hint="판정과 문구로 붙인 분류">
          {r.byReason.length > 0 ? (
            <>
              <Head />
              <div className="divide-y divide-slate-100">
                {r.byReason.map((l) => (
                  <Line key={l.key} l={l} max={reasonMax} />
                ))}
              </div>
            </>
          ) : (
            <p className="px-3 py-3 text-[11px] text-slate-400">
              삭감·보류 항목 없음
            </p>
          )}
        </Card>
        <Card title="부위별" hint="공임 + 재료 + 부품">
          <Head />
          <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
            {r.byGroup.map((l) => (
              <Line key={l.key} l={l} max={groupMax} />
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card title="삭감 큰 항목" hint={`${r.topCuts.length}줄`}>
          <div className="max-h-64 overflow-y-auto">
            <Items items={r.topCuts.slice(0, 12)} tone="cut" />
          </div>
        </Card>
        <Card
          title="보류 · 금액 확인 항목"
          hint="담당자 확정 시 삭감 가능한 금액"
        >
          <div className="max-h-64 overflow-y-auto">
            <Items items={r.heldItems.slice(0, 12)} tone="hold" />
          </div>
        </Card>
      </div>
      <p className="text-[10px] text-slate-400">
        막대: 회색 사정 · 호박 보류·확인 · 빨강 삭감. 담당자 수정이 반영된 현재
        값이며, 수가를 입력하면 시간×수가 기준으로 다시 계산됨.
      </p>
    </div>
  );
}
