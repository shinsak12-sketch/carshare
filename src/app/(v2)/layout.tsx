import { JetBrains_Mono, Noto_Sans_KR } from "next/font/google";
import { requireUser } from "@/lib/dal";
import { CaseScope } from "@/components/CaseScope";
import { V2Shell } from "@/components/v2/V2Shell";

// 손해사정 v2 화면 묶음 — 기존 화면((app) 묶음)과 달리 상단 바 대신 왼쪽 아이콘 레일을 쓴다.
const sans = Noto_Sans_KR({
  variable: "--font-v2-sans",
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
});
const mono = JetBrains_Mono({
  variable: "--font-v2-mono",
  weight: ["500", "700"],
  subsets: ["latin"],
});

export default async function V2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className={`${sans.variable} ${mono.variable} v2 flex min-h-dvh`}>
      <CaseScope userId={user.id} />
      <V2Shell name={user.name} role={user.role}>
        {children}
      </V2Shell>
    </div>
  );
}
