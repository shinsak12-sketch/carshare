import Link from "next/link";
import { requireAdmin } from "@/lib/dal";

// 구버전 화면(손해사정·선견적의 좌우 분할 마스터-디테일 디자인). 새 디자인(견적서 표 옆
// 인라인 판정)이 기본이 되면서 여기로 옮김. 관리자 설정에서만 링크되고 관리자만 열 수 있음.
export default async function LegacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-center text-[11px] font-semibold text-amber-800">
        구버전 화면(관리자 전용) —{" "}
        <Link href="/admin" className="underline">
          관리자 설정으로
        </Link>
      </div>
      {children}
    </>
  );
}
