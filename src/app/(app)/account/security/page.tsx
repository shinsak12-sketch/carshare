import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { fmtKst } from "@/lib/kst";
import { TotpPanel } from "./TotpPanel";

export const dynamic = "force-dynamic";

// 내 계정 > 보안: 비밀번호 변경, 2단계 인증(TOTP) 설정·해제
export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const user = await requireUser();
  const { required } = await searchParams;
  const totpOn = !!user.totpEnabledAt;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">내 계정 · 보안</h1>
        <p className="mt-1 text-sm text-slate-500">
          {user.name}({user.employeeId}) ·{" "}
          {user.role === "ADMIN" ? "관리자" : "직원"}
        </p>
      </div>

      {required === "1" && !totpOn && (
        <div className="rounded-2xl border-l-4 border-amber-500 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <b>관리자 계정은 2단계 인증이 필수입니다.</b> 아래에서 설정을 마치면
          관리자 페이지를 쓸 수 있습니다.
        </div>
      )}

      <section className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
        <div>
          <h2 className="text-sm font-bold text-slate-900">비밀번호</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {user.passwordChangedAt
              ? `마지막 변경 ${fmtKst(user.passwordChangedAt)}`
              : "변경 이력 없음"}
          </p>
        </div>
        <Link
          href="/change-password"
          className="shrink-0 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 active:scale-95"
        >
          비밀번호 변경
        </Link>
      </section>

      <TotpPanel
        enabled={totpOn}
        enabledAt={user.totpEnabledAt?.toISOString() ?? null}
      />
    </main>
  );
}
