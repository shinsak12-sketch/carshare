"use client";

import { useEffect, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ImageLightbox } from "@/components/ImageLightbox";
import { AdjustmentItemList } from "@/components/AdjustmentItemPanels";
import { compressImage } from "@/lib/image-compress";
import type { AdjustmentCaseInfo, AdjustmentResult } from "@/lib/adjustment-types";
import { buildAdjustmentReportText } from "@/lib/format-adjustment-report";
import { buildAdjustmentReviewItems } from "@/lib/adjustment-review-items";

type ParseStatus = "idle" | "parsing" | "done" | "error";

export default function NewAdjustmentPage() {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdjustmentResult | null>(null);
  const [caseInfo, setCaseInfo] = useState<AdjustmentCaseInfo | null>(null);

  const [parseStatus, setParseStatus] = useState<ParseStatus>("idle");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");

  const [imagePreviews, setImagePreviews] = useState<{ url: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [estimatePreviewUrl, setEstimatePreviewUrl] = useState<string | null>(null);
  const [showEstimate, setShowEstimate] = useState(true);

  const [reportCopied, setReportCopied] = useState(false);
  const [opinionCopied, setOpinionCopied] = useState(false);
  const [isEditingOpinion, setIsEditingOpinion] = useState(false);
  const [opinionDraft, setOpinionDraft] = useState("");
  // 새 결과가 들어오면(참조가 바뀌면) 편집 초안을 원문으로 리셋 —
  // 렌더 중 상태 조정 패턴(이펙트로 하면 캐스케이드 렌더 경고가 남).
  const [opinionSyncedResult, setOpinionSyncedResult] = useState<AdjustmentResult | null>(null);
  if (result !== opinionSyncedResult) {
    setOpinionSyncedResult(result);
    setOpinionDraft(result?.overall_opinion ?? "");
    setIsEditingOpinion(false);
  }

  const reviewItems = useMemo(() => (result ? buildAdjustmentReviewItems(result) : []), [result]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [imagePreviews]);

  useEffect(() => {
    return () => {
      if (estimatePreviewUrl) URL.revokeObjectURL(estimatePreviewUrl);
    };
  }, [estimatePreviewUrl]);

  function handleImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setImagePreviews(files.map((file) => ({ url: URL.createObjectURL(file) })));
  }

  async function handleEstimateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setEstimatePreviewUrl(URL.createObjectURL(file));
    setShowEstimate(true);

    setParseStatus("parsing");
    try {
      const formData = new FormData();
      formData.append("estimate", file);
      const res = await fetch("/api/parse-estimate", { method: "POST", body: formData });
      const data = await res.json();

      let filledAny = false;
      if (data.manufacturer && !manufacturer) {
        setManufacturer(data.manufacturer);
        filledAny = true;
      }
      if (data.model && !model) {
        setModel(data.model);
        filledAny = true;
      }
      setParseStatus(filledAny ? "done" : "error");
    } catch {
      setParseStatus("error");
    }
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

      // 사진은 우리 서버를 거치지 않고 브라우저에서 Vercel Blob으로 직접
      // 업로드함 — 서버리스 함수 요청 바디 제한(~4.5MB)과 무관하게 몇십~
      // 백여 장도 올릴 수 있음. 서버에는 업로드된 URL 목록만 전달함.
      const total = rawImages.length;
      let uploadedCount = 0;
      setLoadingStep(`사진 업로드 중… (0/${total})`);

      const CONCURRENCY = 6;
      const imageUrls: string[] = new Array(total);
      let cursor = 0;
      async function worker() {
        while (cursor < total) {
          const i = cursor++;
          const compressed = await compressImage(rawImages[i]);
          const blob = await upload(compressed.name, compressed, {
            access: "public",
            handleUploadUrl: "/api/blob-upload",
          });
          imageUrls[i] = blob.url;
          uploadedCount++;
          setLoadingStep(`사진 업로드 중… (${uploadedCount}/${total})`);
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));

      formData.append("imageUrls", JSON.stringify(imageUrls));

      setLoadingStep("AI 손해사정 중… (사진이 많으면 수 분 소요될 수 있음)");
      const res = await fetch("/api/adjustment", { method: "POST", body: formData });

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
      setResult(data.result as AdjustmentResult);
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
      await navigator.clipboard.writeText(buildAdjustmentReportText(caseInfo, result));
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없는 브라우저 등 — 조용히 무시
    }
  }

  async function handleCopyOpinion() {
    try {
      await navigator.clipboard.writeText(opinionDraft);
      setOpinionCopied(true);
      setTimeout(() => setOpinionCopied(false), 1500);
    } catch {
      // 조용히 무시
    }
  }

  const fileInputClass =
    "w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/40 px-3 py-2 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 file:shadow-sm file:transition-colors hover:border-purple-400 hover:file:bg-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20";
  const textInputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-150 outline-none focus:border-purple-500 focus:shadow-[inset_0_1px_3px_rgba(147,51,234,0.12)] focus:ring-2 focus:ring-purple-500/20";

  return (
    <main className="mx-auto max-w-[1800px] px-6 py-10 lg:py-14">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 lg:text-3xl">AI 손해사정</h1>
          <p className="mt-1 text-sm text-slate-500">
            청구 견적서와 수리작업 사진을 첨부하면 AI가 항목별로 손해사정 의견을 제시합니다.
          </p>
        </div>
        {loading && (
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-bold text-purple-700 sm:text-sm">
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
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
              <label className="mb-1 block text-sm font-medium text-slate-700">청구 견적서 (필수, PDF)</label>
              <input
                name="estimate"
                type="file"
                accept="application/pdf"
                required
                onChange={handleEstimateChange}
                className={fileInputClass}
              />
              {parseStatus === "parsing" && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-purple-600">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
                  견적서 분석 중…
                </p>
              )}
              {parseStatus === "done" && (
                <p className="mt-1.5 text-xs font-medium text-emerald-600">
                  ✓ 차량정보를 자동으로 인식했습니다. 필요하면 아래에서 수정하세요.
                </p>
              )}
              {parseStatus === "error" && (
                <p className="mt-1.5 text-xs text-slate-400">
                  이 견적서에서는 자동 인식된 정보가 없습니다. 아래 항목을 직접 입력해주세요.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                수리작업 사진 (필수, 여러 장 가능)
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
                <label className="mb-1 block text-sm font-medium text-slate-700">제조사</label>
                <input
                  name="manufacturer"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className={textInputClass}
                  placeholder="현대"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">모델</label>
                <input
                  name="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={textInputClass}
                  placeholder="아반떼"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">담당자 추가 의견(프롬프트 추가)</label>
              <textarea
                name="memo"
                rows={2}
                placeholder="예: 이 부위는 재사용이 어려워 보임 / 사고 경위상 확인이 필요함"
                className={textInputClass}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-purple-600 px-4 py-3.5 text-sm font-bold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_16px_-4px_rgba(147,51,234,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-purple-700 hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_22px_-6px_rgba(147,51,234,0.55)] active:translate-y-0 active:scale-95 active:shadow-[0_2px_6px_rgba(147,51,234,0.4)_inset] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {loadingStep || "처리 중…"}
                </span>
              ) : (
                "AI 손해사정 시작"
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
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">손해사정 결과</p>
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

        {/* 중: 수리작업 사진 + 청구 견적서 (가장 넓게) */}
        <div className="flex flex-col gap-4">
          {(imagePreviews.length > 0 || estimatePreviewUrl) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
              {imagePreviews.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    수리작업 사진 ({imagePreviews.length})
                  </p>
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
                              alt={`수리작업 사진 ${i + 1}`}
                              className="h-full w-full rounded-lg border border-slate-200 object-cover transition-transform duration-200 ease-out group-hover:relative group-hover:z-30 group-hover:scale-[4.6] group-hover:shadow-[0_20px_45px_-12px_rgba(15,23,42,0.45)]"
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {estimatePreviewUrl && (
                <div className={imagePreviews.length > 0 ? "mt-4 border-t border-slate-100 pt-4" : ""}>
                  <button
                    type="button"
                    onClick={() => setShowEstimate((v) => !v)}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    {showEstimate ? "견적서 숨기기 ▲" : "청구 견적서 보기 ▾"}
                  </button>
                  {showEstimate && (
                    <iframe
                      src={`${estimatePreviewUrl}#zoom=75`}
                      title="청구 견적서"
                      className="mt-3 h-[75vh] w-full rounded-lg border border-slate-200"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {!result && (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]">
              <span aria-hidden="true" className="text-4xl opacity-50">⚖️</span>
              <p className="text-sm text-slate-400">
                왼쪽에서 견적서와 수리작업 사진을 첨부하고 손해사정을 시작하면
                <br />이 자리에 청구서 미리보기가 표시됩니다.
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

        {/* 우: 검토 항목(위) + 종합의견(아래) */}
        {result && (
          <div className="flex flex-col gap-4 xl:sticky xl:top-6">
            <AdjustmentItemList items={reviewItems} />

            <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">종합 의견</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => setIsEditingOpinion((v) => !v)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all active:scale-95 ${
                      isEditingOpinion ? "bg-emerald-600" : "bg-white/15 hover:bg-white/25"
                    }`}
                  >
                    {isEditingOpinion ? "완료" : "편집"}
                  </button>
                  <button
                    onClick={handleCopyOpinion}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all active:scale-95 ${
                      opinionCopied ? "bg-emerald-600" : "bg-white/15 hover:bg-white/25"
                    }`}
                  >
                    {opinionCopied ? "복사됨 ✓" : "복사"}
                  </button>
                </div>
              </div>
              {isEditingOpinion ? (
                <textarea
                  value={opinionDraft}
                  onChange={(e) => setOpinionDraft(e.target.value)}
                  rows={8}
                  className="mt-1.5 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium leading-relaxed text-white outline-none focus:border-white/40"
                />
              ) : (
                <p className="mt-1.5 whitespace-pre-line text-sm font-medium leading-relaxed text-slate-100">
                  {opinionDraft}
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
