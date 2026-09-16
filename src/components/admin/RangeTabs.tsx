import Link from "next/link";
import type { Range } from "@/lib/admin-stats";

const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "7d", label: "7일" },
  { key: "month", label: "이번 달" },
  { key: "30d", label: "30일" },
];

// 서버 컴포넌트용 기간 탭 — 쿼리스트링으로 상태를 들고 다녀 새로고침·공유해도 유지
export function RangeTabs({
  current,
  basePath,
  params,
}: {
  current: Range;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-bold">
      {RANGES.map((r) => {
        const q = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
        q.set("range", r.key);
        return (
          <Link
            key={r.key}
            href={`${basePath}?${q.toString()}`}
            className={`rounded-md px-3 py-1.5 transition-colors ${current === r.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            {r.label}
          </Link>
        );
      })}
    </div>
  );
}

export function parseRange(v: string | undefined): Range {
  return v === "today" || v === "7d" || v === "30d" ? v : "month";
}
