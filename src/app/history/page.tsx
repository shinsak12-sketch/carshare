import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { derivedDamagedParts } from "@/lib/format-report";
import type { AssessmentResult } from "@/lib/assessment-types";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const cases = await prisma.assessmentCase.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">진단 이력</h1>
          <p className="mt-1 text-sm text-slate-500">총 {cases.length}건</p>
        </div>
        <Link
          href="/assess/new"
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_8px_20px_-6px_rgba(37,99,235,0.55)] active:translate-y-0 active:scale-95"
        >
          + 신규 진단
        </Link>
      </div>

      {cases.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
          아직 등록된 진단 이력이 없습니다.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {cases.map((c) => {
          const result = c.aiResult as unknown as AssessmentResult;
          const disputed = result.disputed_items?.length ?? 0;
          return (
            <Link
              key={c.id}
              href={`/assess/${c.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
            >
              <div>
                <div className="font-semibold text-slate-900">
                  {c.manufacturer} {c.model} {c.year ? `· ${c.year}년식` : ""}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {derivedDamagedParts(result, c.damagedPart)} · {c.createdBy} ·{" "}
                  {c.createdAt.toLocaleDateString("ko-KR")}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                  disputed > 0
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {disputed > 0 ? `협의대상 ${disputed}건` : "협의 항목 없음"}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
