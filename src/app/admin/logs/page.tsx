import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const actionLabel: Record<string, string> = {
  LOGIN_SUCCESS: "로그인 성공",
  LOGIN_FAIL: "로그인 실패",
  LOGIN_BLOCKED: "로그인 임시차단",
  LOGOUT: "로그아웃",
  ACCOUNT_REQUESTED: "계정 신청",
  ACCOUNT_APPROVED: "계정 승인",
  ACCOUNT_REJECTED: "계정 거절",
  ACCOUNT_DISABLED: "계정 비활성화",
  ACCOUNT_ENABLED: "계정 재활성화",
  ACCOUNT_PASSWORD_RESET: "비밀번호 초기화",
  ACCOUNT_ROLE_CHANGED: "역할 변경",
  ASSESSMENT_SUBMITTED: "AI 진단 실행",
};

const actionTone: Record<string, string> = {
  LOGIN_SUCCESS: "bg-emerald-100 text-emerald-900",
  LOGIN_FAIL: "bg-amber-100 text-amber-900",
  LOGIN_BLOCKED: "bg-red-100 text-red-900",
  LOGOUT: "bg-slate-100 text-slate-700",
  ACCOUNT_REQUESTED: "bg-blue-100 text-blue-900",
  ACCOUNT_APPROVED: "bg-emerald-100 text-emerald-900",
  ACCOUNT_REJECTED: "bg-slate-100 text-slate-700",
  ACCOUNT_DISABLED: "bg-red-100 text-red-900",
  ACCOUNT_ENABLED: "bg-emerald-100 text-emerald-900",
  ACCOUNT_PASSWORD_RESET: "bg-amber-100 text-amber-900",
  ACCOUNT_ROLE_CHANGED: "bg-blue-100 text-blue-900",
  ASSESSMENT_SUBMITTED: "bg-slate-100 text-slate-700",
};

export default async function LogsPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { name: true, employeeId: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">접속·활동 기록</h1>
        <p className="mt-1 text-sm text-slate-500">최근 200건. 로그인/로그아웃, 계정 관리, AI 진단 실행 기록입니다.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-500">
              <th className="px-4 py-3 font-semibold">시각</th>
              <th className="px-4 py-3 font-semibold">구분</th>
              <th className="px-4 py-3 font-semibold">행위자</th>
              <th className="px-4 py-3 font-semibold">상세</th>
              <th className="px-4 py-3 font-semibold">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-slate-50 last:border-0 align-top">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                  {log.createdAt.toLocaleString("ko-KR")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      actionTone[log.action] ?? "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {actionLabel[log.action] ?? log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {log.actor ? `${log.actor.name}(${log.actor.employeeId})` : log.actorEmployeeId ?? "-"}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{log.detail ?? "-"}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.ip ?? "-"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                  아직 기록이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
