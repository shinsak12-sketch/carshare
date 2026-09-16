import Link from "next/link";
import { getDashboardStats } from "@/lib/admin-stats";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const { pendingCount, activeCount, caseCount24h, loginFail24h } =
    await getDashboardStats();

  const tiles = [
    {
      label: "승인 대기 계정",
      value: pendingCount,
      href: "/admin/accounts",
      highlight: pendingCount > 0,
    },
    {
      label: "활성 계정 수",
      value: activeCount,
      href: "/admin/accounts",
      highlight: false,
    },
    {
      label: "최근 24시간 진단 건수",
      value: caseCount24h,
      href: "/admin/history",
      highlight: false,
    },
    {
      label: "최근 24시간 로그인 실패",
      value: loginFail24h,
      href: "/admin/logs",
      highlight: loginFail24h >= 5,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">개요</h1>
        <p className="mt-1 text-sm text-slate-500">
          계정 승인 현황과 최근 사용 현황을 한눈에 확인합니다.
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
              className={`text-2xl font-bold ${tile.highlight ? "text-amber-700" : "text-slate-900"}`}
            >
              {tile.value}
            </span>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">
          구버전 화면 (관리자 전용)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          좌우 분할 마스터-디테일 디자인. 새 디자인(견적서 표 옆 인라인 판정)과
          비교용으로 남겨둠. 캐시는 새 화면과 분리돼 있음.
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
