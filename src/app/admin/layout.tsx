import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/dal";
import { AdminNav } from "@/components/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  // 관리자 페이지는 2단계 인증을 켜야 들어올 수 있음(직원 화면은 그대로 사용 가능)
  if (!admin.totpEnabledAt) redirect("/account/security?required=1");

  return (
    <>
      <AdminNav name={admin.name} />
      <main className="mx-auto flex max-w-[1800px] flex-col gap-6 px-6 py-8 xl:px-10">
        {children}
      </main>
    </>
  );
}
