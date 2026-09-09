"use client";

import { useEffect, useMemo, useState } from "react";
import { DamageDiagram } from "@/components/DamageDiagram";
import { ImageLightbox } from "@/components/ImageLightbox";
import { ProcedureItemList } from "@/components/ProcedureItemPanels";
import { compressImage } from "@/lib/image-compress";
import { buildProcedureReportText, type ProcedureCaseInfo } from "@/lib/format-procedure-report";
import { buildProcedureReviewItems } from "@/lib/procedure-review-items";
import type { ProcedureResult } from "@/lib/procedure-types";

export default function NewProcedurePage() {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcedureResult | null>(null);
  const [caseInfo, setCaseInfo] = useState<ProcedureCaseInfo | null>(null);

  const [imagePreviews, setImagePreviews] = useState<{ url: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [reportCopied, setReportCopied] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  // 새 판단 결과가 들어오면(참조가 바뀌면) 편집 초안을 그 결과의 원문으로
  // 리셋 — 렌더 중 상태 조정 패턴(이펙트로 하면 캐스케이드 렌더 경고가 남).
  const [summarySyncedResult, setSummarySyncedResult] = useState<ProcedureResult | null>(null);
  if (result !== summarySyncedResult) {
    setSummarySyncedResult(result);
    setSummaryDraft(result?.overall_summary ?? "");
    setIsEditingSummary(false);
  }

  const reviewItems = useMemo(() => (result ? buildProcedureReviewItems(result) : []), [result]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [imagePreviews]);

  function handleImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setImagePreviews(files.map((file) => ({ url: URL.createObjectURL(file) })));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const imageInput = form.elements.namedItem("images") as HTMLInputElement;
      const rawImages = imageInput.files ? Array.from(imageInput.files) : [];
      formData.delete("images");
      setLoadingStep("사진 압축 중…");
      for (const file of rawImages) {
        formData.append("images", await compressImage(file));
      }

      setLoadingStep("AI 판단 중… (수십 초 소요)");
      const res = await fetch("/api/procedure", { method: "POST", body: formData });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(
          res.status === 413
            ? "첨부 용량이 너무 큽니다. 사진 수를 줄이거나 다시 시도해주세요."
            : `서버 오류 (${res.status}): ${text.slice(0, 200)}`
        );
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "요청에 실패했습니다.");
      setResult(data.result as ProcedureResult);
      setCaseInfo({
        manufacturer: String(formData.get("manufacturer") ?? "") || undefined,
        model: String(formData.get("model") ?? "") || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  }

  async function handleCopyReport() {
    if (!result || !caseInfo) return;
    try {
      await navigator.clipboard.writeText(buildProcedureReportText(caseInfo, result));
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없는 브라우저 등 — 조용히 무시
    }
  }

  async function handleCopySummary() {
    try {
      await navigator.clipboard.writeText(summaryDraft);
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 1500);
    } catch {
      // 조용히 무시
    }
  }

  const fileInputClass =
    "w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/40 px-3 py-2 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 file:shadow-sm file:transition-colors hover:border-blue-400 hover:file:bg-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
  const textInputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-150 outline-none focus:border-blue-500 focus:shadow-[inset_0_1px_3px_rgba(37,99,235,0.12)] focus:ring-2 focus:ring-blue-500/20";

  return (
    <main className="mx-auto max-w-[1800px] px-6 py-10 lg:py-14">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 lg:text-3xl">정비공정 판단</h1>
          <p className="mt-1 text-sm text-slate-500">
            선견적 없이 파손 사진만으로 어떤 작업이 필요한지 AI가 먼저 판단합니다.
            (선견적 접수 후에는 [선견적진단]으로 다시 검증하세요.)
          </p>
        </div>
        {loading && (
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-700 sm:text-sm">
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-orange-300 border-t-orange-600" />
            {loadingStep || "처리 중…"}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_800px_500px] xl:items-start">
        {/* 좌: 입력 폼 + 차량정보 */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-6">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                파손 사진 (필수, 여러 장 가능)
              </label>
              <input
                name="images"
                type="file"
                accept="image/*"
                multiple
                required
                onChange={handleImagesChange}
                className={fileInputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">제조사 (선택)</label>
                <input name="manufacturer" className={textInputClass} placeholder="현대" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">모델 (선택)</label>
                <input name="model" className={textInputClass} placeholder="아반떼" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">메모 (선택)</label>
              <textarea
                name="memo"
                rows={2}
                placeholder="예: 사고 경위, 확인이 필요한 부분 등"
                className={textInputClass}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-orange-600 px-4 py-3.5 text-sm font-bold text-white shadow-[0_6px_16px_-4px_rgba(234,88,12,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-orange-700 hover:shadow-[0_10px_22px_-6px_rgba(234,88,12,0.55)] active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {loadingStep || "처리 중…"}
                </span>
              ) : (
                "AI 판단 시작"
              )}
            </button>
          </form>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {result && caseInfo && (
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">판단 결과</p>
                <button
                  onClick={handleCopyReport}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all active:scale-95 ${
                    reportCopied ? "bg-emerald-600" : "bg-slate-900 hover:bg-slate-800"
                  }`}
                >
                  {reportCopied ? "복사됨 ✓" : "전체 복사"}
                </button>
              </div>

              {(caseInfo.manufacturer || caseInfo.model) && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {caseInfo.manufacturer} {caseInfo.model}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 중: 첨부 사진 + 손상 위치 도해 + 작업 공정 (가장 넓게) */}
        <div className="flex flex-col gap-4">
          {imagePreviews.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                첨부 사진 ({imagePreviews.length})
              </p>
              {/* 사진 개수와 무관하게 폭이 항상 일정하도록 9칸 고정 그리드로 배치
                  (최소 2줄, 사진이 더 많으면 줄만 늘어남). 빈 칸은 점선 플레이스홀더. */}
              <div className="grid grid-cols-9 gap-2">
                {Array.from({ length: Math.max(18, Math.ceil(imagePreviews.length / 9) * 9) }).map((_, i) => {
                  const p = imagePreviews[i];
                  if (!p) {
                    return (
                      <div
                        key={i}
                        className="aspect-square rounded-lg border border-dashed border-slate-200 bg-slate-50/50"
                      />
                    );
                  }
                  return (
                    <div key={i} className="group relative aspect-square">
                      <button type="button" onClick={() => setLightboxIndex(i)} className="absolute inset-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={`첨부 사진 ${i + 1}`}
                          className="h-full w-full rounded-lg border border-slate-200 object-cover transition-transform duration-200 ease-out group-hover:relative group-hover:z-30 group-hover:scale-[4.6] group-hover:shadow-[0_20px_45px_-12px_rgba(15,23,42,0.45)]"
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result ? (
            <>
              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
                <h3 className="text-center text-sm font-bold text-slate-900">손상 위치 도해</h3>
                <DamageDiagram damagedParts={result.damaged_parts} suspectedHiddenDamage={result.suspected_hidden_damage} />
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
                <h3 className="text-sm font-bold text-slate-900">작업 공정</h3>
                {result.process_stages.map((stage, i) => (
                  <div key={i} className="rounded-2xl bg-slate-50 p-4 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-600 text-[12px] font-bold text-white">
                        {i + 1}
                      </span>
                      <p className="text-sm font-bold text-slate-900">{stage.stage_name}</p>
                    </div>
                    <div className="mt-3 flex flex-col gap-2.5 border-l-2 border-orange-200 pl-4">
                      {stage.steps.map((step, j) => (
                        <div key={j}>
                          <p className="text-sm font-bold text-slate-800">{step.title}</p>
                          <p className="mt-0.5 text-xs font-medium text-slate-600">{step.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]">
              <span aria-hidden="true" className="text-4xl opacity-50">🛠️</span>
              <p className="text-sm text-slate-400">
                왼쪽에서 파손 사진을 첨부하고 판단을 시작하면
                <br />이 자리에 손상 도해와 정비공정이 표시됩니다.
                {loading && (
                  <>
                    <br />
                    (우측 상단에서 진행 상태를 확인하세요)
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* 우: 검토 항목(위) + 종합요약(아래) */}
        {result && (
          <div className="flex flex-col gap-4 xl:sticky xl:top-6">
            <ProcedureItemList items={reviewItems} />

            <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">종합 요약</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => setIsEditingSummary((v) => !v)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all active:scale-95 ${
                      isEditingSummary ? "bg-emerald-600" : "bg-white/15 hover:bg-white/25"
                    }`}
                  >
                    {isEditingSummary ? "완료" : "편집"}
                  </button>
                  <button
                    onClick={handleCopySummary}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all active:scale-95 ${
                      summaryCopied ? "bg-emerald-600" : "bg-white/15 hover:bg-white/25"
                    }`}
                  >
                    {summaryCopied ? "복사됨 ✓" : "복사"}
                  </button>
                </div>
              </div>
              {isEditingSummary ? (
                <textarea
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  rows={8}
                  className="mt-1.5 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium leading-relaxed text-white outline-none focus:border-white/40"
                />
              ) : (
                <p className="mt-1.5 whitespace-pre-line text-sm font-medium leading-relaxed text-slate-100">
                  {summaryDraft}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          urls={imagePreviews.map((p) => p.url)}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </main>
  );
}
