import Link from "next/link";
import { getUsageStats } from "@/lib/admin-stats";
import { TOOL_LABEL, type AiTool } from "@/lib/ai-usage";
import { money, num, tok } from "@/lib/format-krw";
import { RangeTabs, parseRange } from "@/components/admin/RangeTabs";
import type { UsageRow } from "@/lib/admin-stats";

export const dynamic = "force-dynamic";

const TOOLS: (AiTool | "")[] = ["", "assess", "adjustment", "procedure", "minor"];
const VERDICT_ORDER = [
  "인정",
  "협의필요",
  "협의대상",
  "과다청구",
  "조사필요",
  "불인정",
];

function VerdictBar({ v }: { v: Record<string, number> }) {
  const total = Object.values(v).reduce((a, b) => a + b, 0);
  if (!total) return <span className="text-slate-300">-</span>;
  const color: Record<string, string> = {
    인정: "bg-emerald-500",
    협의필요: "bg-amber-400",
    협의대상: "bg-amber-400",
    조사필요: "bg-amber-300",
    과다청구: "bg-red-400",
    불인정: "bg-red-600",
  };
  const keys = [
    ...VERDICT_ORDER.filter((k) => v[k]),
    ...Object.keys(v).filter((k) => !VERDICT_ORDER.includes(k)),
  ];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-2 w-40 overflow-hidden rounded-full bg-slate-100">
        {keys.map((k) => (
          <span
            key={k}
            className={`${color[k] ?? "bg-slate-400"}`}
            style={{ width: `${(v[k] / total) * 100}%` }}
            title={`${k} ${v[k]}`}
          />
        ))}
      </div>
      <span className="text-[10px] text-slate-500">
        {keys
          .map((k) => `${k} ${Math.round((v[k] / total) * 100)}%`)
          .join(" · ")}
      </span>
    </div>
  );
}

function UsageTable({ rows, head }: { rows: UsageRow[]; head: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs text-slate-500">
            <th className="px-4 py-3 font-semibold">{head}</th>
            <th className="px-3 py-3 text-right font-semibold">건수</th>
            <th className="px-3 py-3 text-right font-semibold">실패/차단</th>
            <th className="px-3 py-3 text-right font-semibold">입력 토큰</th>
            <th className="px-3 py-3 text-right font-semibold">캐시</th>
            <th className="px-3 py-3 text-right font-semibold">출력(추론)</th>
            <th className="px-3 py-3 text-right font-semibold">비용</th>
            <th className="px-3 py-3 text-right font-semibold">건당</th>
            <th className="px-3 py-3 text-right font-semibold">최대 1건</th>
            <th className="px-4 py-3 font-semibold">판정 분포</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={10}
                className="px-4 py-8 text-center text-xs text-slate-400"
              >
                기간 내 실행 없음
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-slate-50">
              <td className="px-4 py-2.5">
                <div className="font-semibold text-slate-900">{r.label}</div>
                {r.sub && (
                  <div className="text-[11px] text-slate-400">{r.sub}</div>
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {num(r.runs)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                {r.failed}/{r.blocked}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {tok(r.inputTokens)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                {tok(r.cachedInputTokens)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {tok(r.outputTokens)}{" "}
                <span className="text-slate-400">
                  ({tok(r.reasoningTokens)})
                </span>
              </td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                {money(r.costKrw, r.costUsd)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                {r.runs
                  ? money(Math.round(r.costKrw / r.runs), r.costUsd / r.runs)
                  : "-"}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                {money(r.maxCostKrw, r.maxCostUsd)}
              </td>
              <td className="px-4 py-2.5">
                <VerdictBar v={r.verdicts} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const tool = (
    TOOLS.includes((sp.tool ?? "") as AiTool | "") ? sp.tool : ""
  ) as AiTool | "";
  const stats = await getUsageStats(range, tool || null);
  const maxDay = Math.max(1, ...stats.byDay.map((d) => d.costKrw));
  const q = (extra: Record<string, string>) => {
    const p = new URLSearchParams({
      range,
      ...(tool ? { tool } : {}),
      ...extra,
    });
    return `?${p.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">사용량 통계</h1>
          <p className="mt-1 text-sm text-slate-500">
            계정별·도구별 토큰과 비용. 비용은 실행 시점 단가 스냅샷으로 환산.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeTabs
            current={range}
            basePath="/admin/usage"
            params={{ tool: tool || undefined }}
          />
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-bold">
            {TOOLS.map((t) => (
              <Link
                key={t || "all"}
                href={q({ tool: t })}
                className={`rounded-md px-3 py-1.5 transition-colors ${tool === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                {t ? TOOL_LABEL[t] : "전체 도구"}
              </Link>
            ))}
          </div>
          <a
            href={`/admin/usage/export${q({})}`}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            CSV 내보내기
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "비용 합계",
            value: money(stats.total.costKrw, stats.total.costUsd),
          },
          { label: "실행 건수", value: num(stats.total.runs) },
          {
            label: "건당 평균",
            value: stats.total.runs
              ? money(
                  Math.round(stats.total.costKrw / stats.total.runs),
                  stats.total.costUsd / stats.total.runs,
                )
              : "-",
          },
          {
            label: "실패 / 차단",
            value: `${stats.total.failed} / ${stats.total.blocked}`,
          },
        ].map((t) => (
          <div
            key={t.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="text-xs font-semibold text-slate-500">
              {t.label}
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {t.value}
            </div>
          </div>
        ))}
      </div>

      {/* 일별 추이 — 막대는 비용, 숫자는 건수 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">일별 비용 추이</h2>
        {stats.byDay.length === 0 ? (
          <p className="mt-3 text-xs text-slate-400">기간 내 실행 없음</p>
        ) : (
          <div className="mt-3 flex h-40 items-end gap-1 overflow-x-auto">
            {stats.byDay.map((d) => (
              <div
                key={d.day}
                className="flex min-w-[28px] flex-1 flex-col items-center gap-1"
                title={`${d.day} · ${d.runs}건 · ${money(d.costKrw, d.costUsd)}`}
              >
                <span className="text-[10px] tabular-nums text-slate-500">
                  {d.runs}
                </span>
                <div
                  className="w-full rounded-t bg-blue-500/80"
                  style={{
                    height: `${Math.max(2, (d.costKrw / maxDay) * 110)}px`,
                  }}
                />
                <span className="text-[10px] text-slate-400">
                  {d.day.slice(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-slate-900">계정별</h2>
        <UsageTable rows={stats.byUser} head="계정" />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-slate-900">도구별</h2>
        <UsageTable rows={stats.byTool} head="도구" />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-slate-900">모델별</h2>
        <p className="text-xs text-slate-500">
          같은 건을 모델 바꿔 돌렸을 때 건당 비용·토큰 비교용. 판정 분포도 같이
          보세요.
        </p>
        <UsageTable rows={stats.byModel} head="모델" />
      </section>
    </div>
  );
}
