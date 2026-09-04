"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const TABS = [
  { href: "/admin", label: "개요" },
  { href: "/admin/accounts", label: "계정 관리" },
  { href: "/admin/history", label: "진단 이력" },
  { href: "/admin/logs", label: "접속·활동 기록" },
];

export function AdminNav({ name }: { name: string }) {
  const pathname = usePathname();
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
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-bold text-slate-900">관리자 페이지</span>
          <nav className="flex items-center gap-1">
            {TABS.map((tab) => {
              const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-all duration-150 active:scale-95 ${
                    active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">{name}님</span>
          <Link
            href="/"
            className="rounded-full px-3 py-1.5 font-semibold text-blue-600 transition-all duration-150 hover:bg-blue-50 active:scale-95"
          >
            직원 화면
          </Link>
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
