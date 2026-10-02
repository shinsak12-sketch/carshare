"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-150 outline-none focus:border-blue-500 focus:shadow-[inset_0_1px_3px_rgba(37,99,235,0.12)] focus:ring-2 focus:ring-blue-500/20";
const buttonClass =
  "mt-1 rounded-full bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_16px_-4px_rgba(37,99,235,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_22px_-6px_rgba(37,99,235,0.55)] active:translate-y-0 active:scale-95 active:shadow-[0_2px_6px_rgba(37,99,235,0.4)_inset] disabled:cursor-not-allowed disabled:opacity-50";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 2단계 인증이 켜진 계정은 비밀번호 통과 후 코드 입력 단계로
  const [step, setStep] = useState<"password" | "totp">("password");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);

  function goIn(data: { mustChangePassword?: boolean }) {
    router.push(data.mustChangePassword ? "/change-password" : "/");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "로그인에 실패했습니다.");
      if (data.totpRequired) {
        setStep("totp");
        return;
      }
      goIn(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleTotp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.expired) {
          setStep("password");
          setCode("");
        }
        throw new Error(data.error ?? "인증에 실패했습니다.");
      }
      if (data.usedRecovery && typeof data.recoveryLeft === "number")
        alert(
          `복구 코드로 로그인했습니다. 남은 복구 코드 ${data.recoveryLeft}개. 내 계정 > 보안에서 2단계 인증을 다시 설정하는 것을 권장합니다.`,
        );
      goIn(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (step === "totp")
    return (
      <form onSubmit={handleTotp} className="flex flex-col gap-4">
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]">
          <span className="font-bold text-slate-900">2단계 인증</span>
          <br />
          {useRecovery
            ? "복구 코드(예: ab12-cd34) 하나를 입력하세요. 한 번 쓰면 사라집니다."
            : "인증 앱(Google Authenticator 등)에 표시된 6자리 코드를 입력하세요."}
        </div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode={useRecovery ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoFocus
          placeholder={useRecovery ? "xxxx-xxxx" : "000000"}
          maxLength={useRecovery ? 12 : 6}
          className={`${inputClass} text-center font-mono text-lg tracking-[0.3em]`}
        />
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading || !code}
          className={buttonClass}
        >
          {loading ? "확인 중…" : "확인"}
        </button>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <button
            type="button"
            onClick={() => {
              setUseRecovery((v) => !v);
              setCode("");
              setError(null);
            }}
            className="font-semibold text-blue-600 hover:underline"
          >
            {useRecovery
              ? "인증 앱 코드로 입력"
              : "인증 앱을 쓸 수 없나요? 복구 코드 입력"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("password");
              setCode("");
              setError(null);
            }}
            className="hover:underline"
          >
            처음으로
          </button>
        </div>
      </form>
    );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          사번
        </label>
        <input
          name="employeeId"
          required
          autoComplete="username"
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          비밀번호
        </label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
