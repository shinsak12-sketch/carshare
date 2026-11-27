"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cx } from "./ui";

// 왼쪽 아이콘 레일 + 본문. 도구 이동, 계정·관리자·로그아웃을 레일에 둔다.
const ICON = {
  car: (
    <>
      <path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v4h-2" />
      <path d="M3 13v4h2" />
      <circle cx="7.5" cy="17" r="1.8" />
      <circle cx="16.5" cy="17" r="1.8" />
      <path d="M9.5 17h5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16" />
      <path d="M6 20h12" />
      <path d="M5 8h14" />
      <path d="M5 8l-2.5 6a3 3 0 0 0 5 0z" />
      <path d="M19 8l-2.5 6a3 3 0 0 0 5 0z" />
    </>
  ),
  map: (
    <>
      <path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </>
  ),
  out: (
    <>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M15 8l4 4-4 4" />
      <path d="M19 12H9" />
    </>
  ),
} as const;

function Svg({ name }: { name: keyof typeof ICON }) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON[name]}
    </svg>
  );
}

const item = (on = false) =>
  cx(
    "flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-150 active:scale-95",
    on
      ? "bg-gray-900 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
      : "text-gray-600 hover:-translate-y-px hover:bg-gray-100 hover:text-gray-900",
  );

export function V2Shell({
  name,
  role,
  children,
}: {
  name: string;
  role: "EMPLOYEE" | "ADMIN";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }
  return (
    <>
      <nav
        aria-label="도구"
        className="sticky top-0 flex h-dvh w-16 shrink-0 flex-col items-center gap-2 border-r border-[#D9DEE5] bg-white py-3.5"
      >
        <Link
          href="/"
          title="홈"
          aria-label="홈"
          className="num mb-1 flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-[#00704A] text-[13px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_12px_-6px_rgba(0,112,74,0.6)] transition-transform hover:-translate-y-px active:scale-95"
        >
          AI
        </Link>
        <Link
          href="/assess/new"
          title="선견적진단"
          aria-label="선견적진단"
          className={item()}
        >
          <Svg name="car" />
        </Link>
        <Link
          href="/minor/new"
          title="경미손상판독"
          aria-label="경미손상판독"
          className={item()}
        >
          <Svg name="search" />
        </Link>
        <Link
          href="/adjustment-v2/new"
          title="손해사정 v2"
          aria-label="손해사정 v2"
          aria-current="page"
          className={item(true)}
        >
          <Svg name="scale" />
        </Link>
        <Link
          href="/sketch"
          title="약도그림판"
          aria-label="약도그림판"
          className={item()}
        >
          <Svg name="map" />
        </Link>
        <div className="mt-auto flex flex-col items-center gap-2">
          <Link
            href="/account/security"
            title={`${name}님 · 비밀번호 변경 · 2단계 인증`}
            aria-label="내 계정"
            className={item()}
          >
            <Svg name="user" />
          </Link>
          {role === "ADMIN" && (
            <Link
              href="/admin"
              title="관리자 페이지"
              aria-label="관리자 페이지"
              className={item()}
            >
              <Svg name="gear" />
            </Link>
          )}
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            title="로그아웃"
            aria-label="로그아웃"
            className={cx(item(), "disabled:opacity-50")}
          >
            <Svg name="out" />
          </button>
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col bg-[#F3F5F7] text-gray-900">
        {children}
      </div>
    </>
  );
}
