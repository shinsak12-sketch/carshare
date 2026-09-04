import { requireAdmin } from "@/lib/dal";
import { AdminNav } from "@/components/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <>
      <AdminNav name={admin.name} />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">{children}</main>
    </>
  );
}
