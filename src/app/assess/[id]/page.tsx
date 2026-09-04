import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AssessmentResultView } from "@/components/AssessmentResultView";
import type { AssessmentResult } from "@/lib/assessment-types";

export const dynamic = "force-dynamic";

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.assessmentCase.findUnique({
    where: { id },
    include: { images: true },
  });
  if (!item) notFound();

  const result = item.aiResult as unknown as AssessmentResult;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <Link
        href="/history"
        className="self-start rounded-full px-3 py-1.5 text-sm font-semibold text-blue-600 transition-all duration-150 hover:bg-blue-50 active:scale-95"
      >
        ← 이력으로 돌아가기
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {item.manufacturer} {item.model} {item.year ? `· ${item.year}년식` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {item.createdBy} · {item.createdAt.toLocaleString("ko-KR")}
        </p>
        {item.memo && (
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">담당자 추가 의견:</span> {item.memo}
          </p>
        )}
      </div>

      {item.images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {item.images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.id}
              src={`data:${img.mimeType};base64,${Buffer.from(img.data).toString("base64")}`}
              alt="손상 사진"
              className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
            />
          ))}
        </div>
      )}

      {item.estimateText && (
        <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">
            선견적 원문 보기
          </summary>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-600">
            {item.estimateText}
          </pre>
        </details>
      )}

      <div>
        <h2 className="mb-3 text-lg font-bold text-slate-900">AI 진단 결과</h2>
        <AssessmentResultView
          caseInfo={{
            manufacturer: item.manufacturer,
            model: item.model,
            year: item.year,
            damagedPart: item.damagedPart,
            createdAt: item.createdAt,
          }}
          result={result}
        />
      </div>
    </main>
  );
}
