"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "로그인에 실패했습니다.");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">사번</label>
        <input
          name="employeeId"
          required
          autoComplete="username"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-all duration-150 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">비밀번호</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-all duration-150 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 rounded-full bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-[0_6px_16px_-4px_rgba(37,99,235,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_10px_22px_-6px_rgba(37,99,235,0.55)] active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
