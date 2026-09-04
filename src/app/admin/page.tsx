import Link from "next/link";
import { getDashboardStats } from "@/lib/admin-stats";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const { pendingCount, activeCount, caseCount24h, loginFail24h } = await getDashboardStats();

  const tiles = [
    { label: "승인 대기 계정", value: pendingCount, href: "/admin/accounts", highlight: pendingCount > 0 },
    { label: "활성 계정 수", value: activeCount, href: "/admin/accounts", highlight: false },
    { label: "최근 24시간 진단 건수", value: caseCount24h, href: "/admin/history", highlight: false },
    { label: "최근 24시간 로그인 실패", value: loginFail24h, href: "/admin/logs", highlight: loginFail24h >= 5 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">개요</h1>
        <p className="mt-1 text-sm text-slate-500">계정 승인 현황과 최근 사용 현황을 한눈에 확인합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className={`flex flex-col gap-1.5 rounded-2xl border bg-white p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] ${
              tile.highlight ? "border-amber-300 bg-amber-50" : "border-slate-200"
            }`}
          >
            <span className="text-xs font-semibold text-slate-500">{tile.label}</span>
            <span className={`text-2xl font-bold ${tile.highlight ? "text-amber-700" : "text-slate-900"}`}>
              {tile.value}
            </span>
          </Link>
        ))}
      </div>

      {pendingCount > 0 && (
        <div className="rounded-2xl border-l-4 border-amber-500 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          승인 대기 중인 계정이 {pendingCount}건 있습니다.{" "}
          <Link href="/admin/accounts" className="font-semibold underline">
            계정 관리에서 확인
          </Link>
        </div>
      )}
    </div>
  );
}
