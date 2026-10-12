import Link from "next/link";
import { requireAdmin } from "@/lib/dal";

// 관리자 전용 화면 묶음. 구버전 화면(손해사정·선견적의 좌우 분할 디자인)과 홈에서 뺀
// 정비공정이 여기 있음. 관리자 설정에서만 링크되고 관리자만 열 수 있음.
export default async function LegacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-center text-[11px] font-semibold text-amber-800">
        관리자 전용 화면 —{" "}
        <Link href="/admin" className="underline">
          관리자 설정으로
        </Link>
      </div>
      {children}
    </>
  );
}
