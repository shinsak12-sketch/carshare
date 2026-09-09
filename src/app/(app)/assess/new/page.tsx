"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageLightbox } from "@/components/ImageLightbox";
import { ReviewItemList } from "@/components/ReviewItemPanels";
import { compressImage } from "@/lib/image-compress";
import type { AssessmentResult } from "@/lib/assessment-types";
import { buildReportText, derivedDamagedParts, type ReportCaseInfo } from "@/lib/format-report";
import { buildReviewItems } from "@/lib/review-items";

type ParseStatus = "idle" | "parsing" | "done" | "error";

export default function NewAssessmentPage() {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [caseInfo, setCaseInfo] = useState<ReportCaseInfo | null>(null);

  const [parseStatus, setParseStatus] = useState<ParseStatus>("idle");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");

  const [imagePreviews, setImagePreviews] = useState<{ url: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [hoveredPhoto, setHoveredPhoto] = useState<number | null>(null);
  const [estimatePreviewUrl, setEstimatePreviewUrl] = useState<string | null>(null);
  const [showEstimate, setShowEstimate] = useState(true);

  const [reportCopied, setReportCopied] = useState(false);
  const [opinionCopied, setOpinionCopied] = useState(false);
  const [isEditingOpinion, setIsEditingOpinion] = useState(false);
  const [opinionDraft, setOpinionDraft] = useState("");
  // 새 진단 결과가 들어오면(참조가 바뀌면) 편집 초안을 그 결과의 원문으로
  // 리셋 — 렌더 중 상태 조정 패턴(이펙트로 하면 캐스케이드 렌더 경고가 남).
  const [opinionSyncedResult, setOpinionSyncedResult] = useState<AssessmentResult | null>(null);
  if (result !== opinionSyncedResult) {
    setOpinionSyncedResult(result);
    setOpinionDraft(result?.overall_opinion ?? "");
    setIsEditingOpinion(false);
  }

  const reviewItems = useMemo(() => (result ? buildReviewItems(result) : []), [result]);

  // 미리보기용 objectURL은 화면에서만 쓰고 서버로는 절대 저장되지 않음 —
  // 목록이 바뀌거나 화면을 벗어나면 곧바로 해제.
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
      if (data.year && !year) {
        setYear(String(data.year));
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
      setLoadingStep("사진 압축 중…");
      for (const file of rawImages) {
        formData.append("images", await compressImage(file));
      }

      setLoadingStep("AI 진단 중… (수십 초 소요)");
      const res = await fetch("/api/assess", { method: "POST", body: formData });

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
      setResult(data.result as AssessmentResult);
      setCaseInfo({
        manufacturer: String(formData.get("manufacturer") ?? ""),
        model: String(formData.get("model") ?? ""),
        year: formData.get("year") ? Number(formData.get("year")) : undefined,
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
      await navigator.clipboard.writeText(buildReportText(caseInfo, result));
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
    "w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm transition-all duration-150 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 file:transition-colors hover:border-blue-400 hover:file:bg-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
  const textInputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-all duration-150 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  return (
    <main className="mx-auto max-w-[1800px] px-6 py-10 lg:py-14">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 lg:text-3xl">신규 진단</h1>
        <p className="mt-1 text-sm text-slate-500">
          선견적과 파손 사진을 먼저 첨부하면 차량정보를 자동으로 채워줍니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[400px_minmax(0,1fr)_460px] xl:items-start">
        {/* 좌: 입력 폼 + 차량정보 */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-6">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                선견적 첨부 (선택, PDF)
              </label>
              <input
                name="estimate"
                type="file"
                accept="application/pdf"
                onChange={handleEstimateChange}
                className={fileInputClass}
              />
              {parseStatus === "parsing" && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-blue-600">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                  선견적 분석 중…
                </p>
              )}
              {parseStatus === "done" && (
                <p className="mt-1.5 text-xs font-medium text-emerald-600">
                  ✓ 차량정보를 자동으로 인식했습니다. 필요하면 아래에서 수정하세요.
                </p>
              )}
              {parseStatus === "error" && (
                <p className="mt-1.5 text-xs text-slate-400">
                  이 선견적에서는 자동 인식된 정보가 없습니다. 아래 항목을 직접 입력해주세요.
                </p>
              )}
            </div>

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

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">제조사</label>
                <input
                  name="manufacturer"
                  required
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
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={textInputClass}
                  placeholder="아반떼"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">연식</label>
                <input
                  name="year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className={textInputClass}
                  placeholder="2022"
                />
              </div>
            </div>
            <p className="-mt-4 text-xs text-slate-400">
              이 견적서 양식에는 제조사/모델/연식이 인쇄되지 않는 경우가 많습니다 — 그럴 땐 직접 입력해주세요.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">담당자 추가 의견</label>
              <textarea
                name="memo"
                rows={2}
                placeholder="예: 파손부위가 사진과 다르게 보임 / 사고 경위상 이 부위 손상이 이상함"
                className={textInputClass}
              />
              <p className="mt-1 text-xs text-slate-400">
                여기 적은 내용은 AI 검토 프롬프트에 그대로 전달되어 검토에 반영됩니다.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-[0_6px_16px_-4px_rgba(37,99,235,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_10px_22px_-6px_rgba(37,99,235,0.55)] active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_6px_16px_-4px_rgba(37,99,235,0.5)]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {loadingStep || "처리 중…"}
                </span>
              ) : (
                "AI 진단 시작"
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
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">진단 결과</p>
                <button
                  onClick={handleCopyReport}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all active:scale-95 ${
                    reportCopied ? "bg-emerald-600" : "bg-slate-900 hover:bg-slate-800"
                  }`}
                >
                  {reportCopied ? "복사됨 ✓" : "전체 복사"}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {caseInfo.manufacturer} {caseInfo.model}
                  {caseInfo.year ? ` · ${caseInfo.year}년식` : ""}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  손상부위: {derivedDamagedParts(result, caseInfo.damagedPart)}
                </span>
              </div>

              {!result.estimate_provided && (
                <div className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-medium text-slate-600">
                  선견적 데이터가 제공되지 않아 사진 기반 손상유형 판독만 제공되었습니다. 청구 타당성은 별도
                  확인이 필요합니다.
                </div>
              )}
            </div>
          )}
        </div>

        {/* 중: 첨부 사진 + 선견적 (가장 넓게) */}
        <div className="flex flex-col gap-4">
          {(imagePreviews.length > 0 || estimatePreviewUrl) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
              {imagePreviews.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    첨부 사진 ({imagePreviews.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {imagePreviews.map((p, i) => (
                      <div
                        key={i}
                        className="relative"
                        onMouseEnter={() => setHoveredPhoto(i)}
                        onMouseLeave={() => setHoveredPhoto((cur) => (cur === i ? null : cur))}
                      >
                        <button
                          type="button"
                          onClick={() => setLightboxIndex(i)}
                          className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 transition-transform duration-150 hover:scale-105"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={`첨부 사진 ${i + 1}`} className="h-full w-full object-cover" />
                        </button>

                        {hoveredPhoto === i && (
                          <div className="pointer-events-none absolute top-full left-1/2 z-30 mt-2 -translate-x-1/2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.url}
                              alt=""
                              className="h-56 w-56 rounded-xl border-4 border-white object-cover shadow-[0_20px_45px_-12px_rgba(15,23,42,0.45)]"
                            />
                          </div>
                        )}
                      </div>
                    ))}
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
                    {showEstimate ? "선견적 숨기기 ▲" : "첨부된 선견적 보기 ▾"}
                  </button>
                  {showEstimate && (
                    <iframe
                      src={`${estimatePreviewUrl}#zoom=75`}
                      title="첨부된 선견적"
                      className="mt-3 h-[75vh] w-full rounded-lg border border-slate-200"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {!result && (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]">
              {loading ? (
                <>
                  <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-blue-200 border-t-blue-600" />
                  <p className="text-sm font-medium text-slate-600">{loadingStep || "처리 중…"}</p>
                </>
              ) : (
                <>
                  <span aria-hidden="true" className="text-4xl opacity-50">📋</span>
                  <p className="text-sm text-slate-400">
                    왼쪽에서 파손 사진을 첨부하고 진단을 시작하면
                    <br />이 자리에 결과 보고서가 표시됩니다.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* 우: 검토 항목(위) + 종합의견(아래) */}
        {result && (
          <div className="flex flex-col gap-4 xl:sticky xl:top-6">
            <ReviewItemList items={reviewItems} />

            <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  종합 의견 <span className="normal-case text-slate-500">· 거래처 발신용</span>
                </p>
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
                  rows={10}
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
