import Link from "next/link";
import { RequestAccessForm } from "./RequestAccessForm";

export const dynamic = "force-dynamic";

export default function RequestAccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">계정 권한 신청</h1>
        <p className="mt-1 text-sm text-slate-500">
          신청 후 관리자 승인이 완료되면 로그인할 수 있습니다.
        </p>
      </div>

      <RequestAccessForm />

      <p className="text-center text-sm text-slate-500">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-semibold text-blue-600 hover:underline">
          로그인
        </Link>
      </p>
    </main>
  );
}
