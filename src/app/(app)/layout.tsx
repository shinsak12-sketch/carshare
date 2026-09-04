import { requireUser } from "@/lib/dal";
import { TopNav } from "@/components/TopNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <>
      <TopNav name={user.name} role={user.role} />
      {children}
    </>
  );
}
