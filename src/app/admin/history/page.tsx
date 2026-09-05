import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { derivedDamagedParts } from "@/lib/format-report";
import type { AssessmentResult } from "@/lib/assessment-types";

export const dynamic = "force-dynamic";

export default async function AdminHistoryPage() {
  const cases = await prisma.assessmentCase.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, employeeId: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">진단 이력</h1>
        <p className="mt-1 text-sm text-slate-500">총 {cases.length}건 · 사진은 저장하지 않으며 판정 결과만 보관됩니다.</p>
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
              href={`/admin/history/${c.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
            >
              <div>
                <div className="font-semibold text-slate-900">
                  {c.manufacturer} {c.model} {c.year ? `· ${c.year}년식` : ""}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {derivedDamagedParts(result, c.damagedPart)} ·{" "}
                  {c.user ? `${c.user.name}(${c.user.employeeId})` : "알 수 없음"} ·{" "}
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
    </div>
  );
}
