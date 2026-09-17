import Link from "next/link";
import { getDashboardStats } from "@/lib/admin-stats";
import { getAnomalies } from "@/lib/usage-policy";
import { TOOL_LABEL, type AiTool } from "@/lib/ai-usage";
import { krw, money, num, dt } from "@/lib/format-krw";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [s, anomalies] = await Promise.all([
    getDashboardStats(),
    getAnomalies(),
  ]);

  const tiles = [
    {
      label: "이번 달 AI 비용",
      value: money(s.monthCost, s.monthCostUsd),
      href: "/admin/usage",
      highlight: false,
    },
    {
      label: "이번 달 실행 건수",
      value: num(s.monthRuns),
      href: "/admin/usage",
      highlight: false,
    },
    {
      label: "건당 평균 비용",
      value: money(s.avgCost, s.avgCostUsd),
      href: "/admin/usage",
      highlight: false,
    },
    {
      label: "오늘 실행",
      value: num(s.todayCount),
      href: "/admin/runs?range=today",
      highlight: false,
    },
    {
      label: "이번 달 실패",
      value: num(s.failedMonth),
      href: "/admin/runs?status=failed",
      highlight: s.failedMonth > 0,
    },
    {
      label: "이번 달 차단",
      value: num(s.blockedMonth),
      href: "/admin/runs?status=blocked",
      highlight: s.blockedMonth > 0,
    },
    {
      label: "같은 차량 재실행",
      value: `${num(s.duplicateVehicles)}대`,
      href: "/admin/runs",
      highlight: s.duplicateVehicles > 0,
    },
    {
      label: "승인 대기 계정",
      value: num(s.pendingCount),
      href: "/admin/accounts",
      highlight: s.pendingCount > 0,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">개요</h1>
        <p className="mt-1 text-sm text-slate-500">
          AI 사용 비용·건수와 계정 현황. 비용은 실행 시점 단가로 환산한
          값입니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className={`flex flex-col gap-1.5 rounded-2xl border bg-white p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] ${
              tile.highlight
                ? "border-amber-300 bg-amber-50"
                : "border-slate-200"
            }`}
          >
            <span className="text-xs font-semibold text-slate-500">
              {tile.label}
            </span>
            <span
              className={`text-2xl font-bold tabular-nums ${tile.highlight ? "text-amber-700" : "text-slate-900"}`}
            >
              {tile.value}
            </span>
          </Link>
        ))}
      </div>

      {anomalies.items.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-slate-900">이상 징후</h2>
          {anomalies.items.map((a, i) => (
            <Link
              key={i}
              href={a.href}
              className={`rounded-2xl border-l-4 px-5 py-3 text-sm transition-colors ${a.tone === "error" ? "border-red-500 bg-red-50 text-red-900 hover:bg-red-100" : "border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100"}`}
            >
              {a.text}
            </Link>
          ))}
        </div>
      )}
      {anomalies.policy.monthlyBudgetKrw != null && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs text-slate-600 shadow-sm">
          이번 달 예산 {krw(anomalies.policy.monthlyBudgetKrw)} 중{" "}
          {money(anomalies.monthSpent, s.monthCostUsd)} 사용 (
          {Math.round(
            (anomalies.monthSpent /
              Math.max(1, anomalies.policy.monthlyBudgetKrw)) *
              100,
          )}
          %)
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{
                width: `${Math.min(100, (anomalies.monthSpent / Math.max(1, anomalies.policy.monthlyBudgetKrw)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {(s.pendingCount > 0 || s.loginFail24h >= 5) && (
        <div className="rounded-2xl border-l-4 border-amber-500 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {s.pendingCount > 0 && (
            <>
              승인 대기 중인 계정이 {s.pendingCount}건 있습니다.{" "}
              <Link href="/admin/accounts" className="font-semibold underline">
                계정 관리에서 확인
              </Link>
            </>
          )}
          {s.loginFail24h >= 5 && (
            <div>최근 24시간 로그인 실패 {s.loginFail24h}건.</div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-sm font-bold text-slate-900">최근 실행 10건</h2>
          <Link
            href="/admin/runs"
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            전체 보기
          </Link>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-y border-slate-100 text-xs text-slate-500">
              <th className="px-5 py-2 font-semibold">시각</th>
              <th className="px-3 py-2 font-semibold">계정</th>
              <th className="px-3 py-2 font-semibold">도구</th>
              <th className="px-3 py-2 font-semibold">모델</th>
              <th className="px-3 py-2 font-semibold">차량</th>
              <th className="px-3 py-2 text-right font-semibold">사진</th>
              <th className="px-3 py-2 text-right font-semibold">비용</th>
              <th className="px-5 py-2 font-semibold">상태</th>
            </tr>
          </thead>
          <tbody>
            {s.recent.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-8 text-center text-xs text-slate-400"
                >
                  아직 실행 기록이 없습니다.
                </td>
              </tr>
            )}
            {s.recent.map((r) => (
              <tr key={r.id} className="border-b border-slate-50">
                <td className="px-5 py-2 tabular-nums text-slate-600">
                  {dt(r.createdAt)}
                </td>
                <td className="px-3 py-2 text-slate-800">
                  {r.user?.name ?? r.employeeId}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {TOOL_LABEL[r.tool as AiTool] ?? r.tool}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                  {r.model}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">
                  {r.plateNo ?? "-"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                  {r.photoCount}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                  {money(r.costKrw, r.costUsd)}
                </td>
                <td className="px-5 py-2">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">
          구버전 화면 (관리자 전용)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          좌우 분할 마스터-디테일 디자인. 새 디자인(견적서 표 옆 인라인 판정)과
          비교용. 캐시는 새 화면과 분리돼 있음.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/legacy/adjustment/new"
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            AI손해사정 (구버전)
          </Link>
          <Link
            href="/legacy/assess/new"
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            선견적진단 (구버전)
          </Link>
        </div>
      </div>
    </div>
  );
}
