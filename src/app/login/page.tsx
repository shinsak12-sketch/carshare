import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-200/40 via-orange-100/30 to-transparent blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-blue-500 to-blue-700 text-4xl shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_-3px_6px_rgba(0,0,0,0.15)_inset,0_10px_22px_-8px_rgba(15,23,42,0.5)]">
            🚗
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">차량 손상 AI 진단</h1>
            <p className="mt-1 text-sm text-slate-500">사내 직원 전용 도구입니다. 사번으로 로그인해주세요.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_16px_36px_-16px_rgba(15,23,42,0.25)] sm:p-8">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          아직 계정이 없으신가요?{" "}
          <Link href="/request-access" className="font-semibold text-blue-600 hover:underline">
            계정 권한 신청
          </Link>
        </p>
      </div>
    </main>
  );
}
