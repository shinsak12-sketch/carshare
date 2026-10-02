import { requireUser } from "@/lib/dal";
import { CaseScope } from "@/components/CaseScope";

// 인쇄·PDF 저장용 보고서 화면. 상단 내비 없이 본문만(브라우저 인쇄 → "PDF로 저장").
export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <>
      <CaseScope userId={user.id} />
      {children}
    </>
  );
}
