import Link from "next/link";
import { RequestAccessForm } from "./RequestAccessForm";

export const dynamic = "force-dynamic";

export default function RequestAccessPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-200/40 via-orange-100/30 to-transparent blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-slate-500 to-slate-700 text-4xl shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_-3px_6px_rgba(0,0,0,0.15)_inset,0_10px_22px_-8px_rgba(15,23,42,0.5)]">
            🔑
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">계정 권한 신청</h1>
            <p className="mt-1 text-sm text-slate-500">신청 후 관리자 승인이 완료되면 로그인할 수 있습니다.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_16px_36px_-16px_rgba(15,23,42,0.25)] sm:p-8">
          <RequestAccessForm />
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-blue-600 hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
