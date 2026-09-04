"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TopNav({ name, role }: { name: string; role: "EMPLOYEE" | "ADMIN" }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-sm font-bold text-slate-900">
          차량 손상 AI 진단
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">{name}님</span>
          {role === "ADMIN" && (
            <Link
              href="/admin"
              className="rounded-full px-3 py-1.5 font-semibold text-blue-600 transition-all duration-150 hover:bg-blue-50 active:scale-95"
            >
              관리자 페이지
            </Link>
          )}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-full border border-slate-300 px-3 py-1.5 font-semibold text-slate-600 transition-all duration-150 hover:-translate-y-0.5 hover:bg-slate-50 active:translate-y-0 active:scale-95 disabled:opacity-50"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
