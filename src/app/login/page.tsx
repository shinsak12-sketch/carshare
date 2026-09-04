import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">차량 손상 AI 진단</h1>
        <p className="mt-1 text-sm text-slate-500">사내 직원 전용 도구입니다. 사번으로 로그인해주세요.</p>
      </div>

      <LoginForm />

      <p className="text-center text-sm text-slate-500">
        아직 계정이 없으신가요?{" "}
        <Link href="/request-access" className="font-semibold text-blue-600 hover:underline">
          계정 권한 신청
        </Link>
      </p>
    </main>
  );
}
