import { requireUser } from "@/lib/dal";
import { CaseScope } from "@/components/CaseScope";
import { TopNav } from "@/components/TopNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <>
      <CaseScope userId={user.id} />
      <TopNav name={user.name} role={user.role} />
      {children}
    </>
  );
}
