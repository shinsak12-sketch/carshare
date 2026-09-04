import { prisma } from "@/lib/prisma";
import { AccountsTable } from "./AccountsTable";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">계정 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          권한 신청 승인/거절, 계정 활성화 상태, 비밀번호 초기화, 역할 변경을 처리합니다.
        </p>
      </div>
      <AccountsTable
        initialUsers={users.map((u) => ({
          id: u.id,
          employeeId: u.employeeId,
          name: u.name,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
