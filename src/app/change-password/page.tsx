import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { PASSWORD_RULE_TEXT } from "@/lib/password";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

// 비밀번호 변경. 강제 상태(mustChangePassword)면 다른 화면이 전부 여기로 보냄.
// (app) 레이아웃 바깥에 두는 이유: requireUser가 여기로 리다이렉트하므로 순환을 피하려고.
export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const forced = user.mustChangePassword;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-200/40 via-orange-100/30 to-transparent blur-3xl"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-slate-700 to-slate-900 text-3xl shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_-3px_6px_rgba(0,0,0,0.15)_inset,0_10px_22px_-8px_rgba(15,23,42,0.5)]">
            🔐
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">비밀번호 변경</h1>
            <p className="mt-1 text-sm text-slate-500">
              {forced
                ? "관리자가 지정한 임시 비밀번호입니다. 계속하려면 새 비밀번호로 바꿔주세요."
                : `${user.name}님의 비밀번호를 변경합니다.`}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_16px_36px_-16px_rgba(15,23,42,0.25)] sm:p-8">
          <ChangePasswordForm forced={forced} ruleText={PASSWORD_RULE_TEXT} />
        </div>
      </div>
    </main>
  );
}
