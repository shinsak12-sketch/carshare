"use client";

import { useState } from "react";
import Link from "next/link";

export function RequestAccessForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/request-access", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "신청에 실패했습니다.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center">
        <p className="text-sm font-semibold text-emerald-900">신청이 접수되었습니다.</p>
        <p className="text-sm text-emerald-800">관리자 승인 후 신청하신 사번과 비밀번호로 로그인할 수 있습니다.</p>
        <Link
          href="/login"
          className="mx-auto rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-emerald-700 active:translate-y-0 active:scale-95"
        >
          로그인 화면으로
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">사번</label>
        <input
          name="employeeId"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-all duration-150 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">이름</label>
        <input
          name="name"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-all duration-150 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">비밀번호 (8자 이상)</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-all duration-150 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">비밀번호 확인</label>
        <input
          name="passwordConfirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
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
        {loading ? "신청 중…" : "권한 신청"}
      </button>
    </form>
  );
}
