"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ImageLightbox } from "@/components/ImageLightbox";
import { PhotoGrid } from "@/components/PhotoGrid";
import { DiagnosticsPanel } from "@/components/DiagnosticsPanel";
import { compressImage } from "@/lib/image-compress";
import type { AdjustmentResult } from "@/lib/adjustment-types";
import { buildAdjustmentReportText } from "@/lib/format-adjustment-report";
import { buildAdjustmentDiagnostics } from "@/lib/adjustment-review-items";
import {
  caseTitle,
  deleteCase,
  emptyCase,
  loadCases,
  loadFiles,
  saveCase,
  saveFiles,
  type StoredCase,
} from "@/lib/adjustment-store";

export default function NewAdjustmentPage() {
  // 건별 탭 — 엑셀 시트처럼. 결과·사진·견적서는 IndexedDB에 캐시돼 새로고침해도 유지.
  const [cases, setCases] = useState<StoredCase[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const active = cases.find((c) => c.id === activeId) ?? null;

  // 활성 건의 파일 (input이 아니라 state가 원본 — 캐시 복원 시 input엔 못 넣으니까)
  const [photos, setPhotos] = useState<File[]>([]);
  const [estimateFile, setEstimateFile] = useState<File | null>(null);
  // 탭 전환 시 <input type=file>을 비우기 위한 리마운트 키
  const [fileInputKey, setFileInputKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [highlightedPhotos, setHighlightedPhotos] = useState<number[]>([]);
  const [showEstimate, setShowEstimate] = useState(true);
  const [reportCopied, setReportCopied] = useState(false);

  const result = active?.result ?? null;
  const diagnostics = useMemo(
    () => (result ? buildAdjustmentDiagnostics(result) : null),
    [result],
  );

  const imagePreviews = useMemo(
    () => photos.map((f) => ({ url: URL.createObjectURL(f) })),
    [photos],
  );
  useEffect(
    () => () => imagePreviews.forEach((p) => URL.revokeObjectURL(p.url)),
    [imagePreviews],
  );
  const estimatePreviewUrl = useMemo(
    () => (estimateFile ? URL.createObjectURL(estimateFile) : null),
    [estimateFile],
  );
  useEffect(
    () => () => {
      if (estimatePreviewUrl) URL.revokeObjectURL(estimatePreviewUrl);
    },
    [estimatePreviewUrl],
  );

  // 최초 로드: 캐시된 건 복원, 없으면 빈 건 하나
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadCases();
      if (cancelled) return;
      const list = stored.length ? stored : [emptyCase()];
      setCases(list);
      setActiveId(list[list.length - 1].id);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 활성 건 바뀌면 그 건의 파일 복원
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      const f = await loadFiles(activeId);
      if (cancelled) return;
      setPhotos(f.photos);
      setEstimateFile(f.estimate);
      setFileInputKey((k) => k + 1);
      setError(null);
      setHighlightedPhotos([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const updateActive = useCallback(
    (patch: Partial<StoredCase>) => {
      if (!activeId) return;
      setCases((prev) => {
        const next = prev.map((c) =>
          c.id === activeId ? { ...c, ...patch } : c,
        );
        const updated = next.find((c) => c.id === activeId);
        if (updated) void saveCase(updated);
        return next;
      });
    },
    [activeId],
  );

  function addCase() {
    const c = emptyCase();
    setCases((prev) => [...prev, c]);
    void saveCase(c);
    setActiveId(c.id);
  }

  function removeCase(id: string) {
    setCases((prev) => {
      const next = prev.filter((c) => c.id !== id);
      const list = next.length ? next : [emptyCase()];
      if (!next.length) void saveCase(list[0]);
      if (id === activeId) setActiveId(list[list.length - 1].id);
      return list;
    });
    void deleteCase(id);
  }

  function handleImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setPhotos(files);
    updateActive({ photoCount: files.length });
    if (activeId)
      void saveFiles(activeId, { estimate: estimateFile, photos: files });
  }

  function handleEstimateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEstimateFile(file);
    setShowEstimate(true);
    updateActive({ estimateName: file.name });
    if (activeId) void saveFiles(activeId, { estimate: file, photos });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!active || !activeId) return;
    if (!estimateFile) {
      setError("청구 견적서(PDF)를 첨부해주세요.");
      return;
    }
    if (photos.length === 0) {
      setError("수리작업 사진을 1장 이상 첨부해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    updateActive({ result: null, caseInfo: null });

    const caseId = activeId;
    try {
      const total = photos.length;
      let uploadedCount = 0;
      setLoadingStep(`사진 업로드 중… (0/${total})`);

      // 브라우저 → Vercel Blob 직접 업로드(서버 바디 제한 우회). 압축본을 캐시에도 씀.
      const CONCURRENCY = 6;
      const imageUrls: string[] = new Array(total);
      const compressedFiles: File[] = new Array(total);
      let cursor = 0;
      async function worker() {
        while (cursor < total) {
          const i = cursor++;
          const compressed = await compressImage(photos[i]);
          compressedFiles[i] = compressed;
          const blob = await upload(compressed.name, compressed, {
            access: "public",
            handleUploadUrl: "/api/blob-upload",
          });
          imageUrls[i] = blob.url;
          uploadedCount++;
          setLoadingStep(`사진 업로드 중… (${uploadedCount}/${total})`);
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, total) }, worker),
      );
      void saveFiles(caseId, {
        estimate: estimateFile,
        photos: compressedFiles,
      });

      const formData = new FormData();
      formData.append("estimate", estimateFile);
      formData.append("manufacturer", active.manufacturer);
      formData.append("model", active.model);
      formData.append("memo", active.memo);
      formData.append("imageUrls", JSON.stringify(imageUrls));

      setLoadingStep("AI 손해사정 중… (사진이 많으면 수 분 소요될 수 있음)");
      const res = await fetch("/api/adjustment", {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(
          res.status === 413
            ? "청구 견적서(PDF) 용량이 너무 큽니다. 다른 파일로 다시 시도해주세요."
            : `서버 오류 (${res.status}): ${text.slice(0, 200)}`,
        );
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "요청에 실패했습니다.");
      const r = data.result as AdjustmentResult;
      // 분석 도중 다른 탭으로 옮겼어도 결과는 원래 건에 저장
      setCases((prev) => {
        const next = prev.map((c) =>
          c.id === caseId
            ? {
                ...c,
                result: r,
                caseInfo: {
                  manufacturer: c.manufacturer || undefined,
                  model: c.model || undefined,
                },
              }
            : c,
        );
        const updated = next.find((c) => c.id === caseId);
        if (updated) void saveCase(updated);
        return next;
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  }

  async function handleCopyReport() {
    if (!active?.result || !active.caseInfo) return;
    try {
      await navigator.clipboard.writeText(
        buildAdjustmentReportText(active.caseInfo, active.result),
      );
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 1500);
    } catch {
      // 클립보드 권한 없는 브라우저 — 조용히 무시
    }
  }

  const fileInputClass =
    "w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/40 px-3 py-1.5 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 file:shadow-sm file:transition-colors hover:border-purple-400 hover:file:bg-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20";
  const textInputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-150 outline-none focus:border-purple-500 focus:shadow-[inset_0_1px_3px_rgba(147,51,234,0.12)] focus:ring-2 focus:ring-purple-500/20";

  return (
    <main className="mx-auto flex max-w-[1880px] flex-col px-6 py-8 lg:py-10 xl:h-[calc(100dvh-57px)] xl:py-4">
      {/* 제목 + 탭 바 + 입력 바 — 엑셀 틀 고정처럼 페이지가 스크롤돼도 상단에 붙어 있음 */}
      <div className="sticky top-0 z-30 -mx-6 shrink-0 bg-[var(--background)] px-6 pt-1 xl:pt-0">
        <div className="mb-3 flex shrink-0 items-end justify-between gap-4">
          <div className="flex min-w-0 items-end gap-4">
            <h1 className="shrink-0 text-2xl font-bold text-slate-900 lg:text-3xl">
              AI 손해사정
            </h1>
            <div className="flex min-w-0 items-end gap-1 overflow-x-auto">
              {cases.map((c, i) => {
                const isActive = c.id === activeId;
                return (
                  <div
                    key={c.id}
                    className={`group flex shrink-0 items-center gap-1.5 rounded-t-xl border border-b-0 px-3.5 py-2 text-xs font-bold transition-colors ${
                      isActive
                        ? "border-purple-300 bg-white text-purple-700 shadow-[0_-4px_12px_-8px_rgba(147,51,234,0.4)]"
                        : "border-transparent bg-slate-200/60 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveId(c.id)}
                      className="flex items-center gap-1.5"
                    >
                      {c.result && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      )}
                      {caseTitle(c, i)}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCase(c.id)}
                      title="이 건 닫기"
                      className="rounded-full px-1 text-[10px] text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addCase}
                className="shrink-0 rounded-t-xl border border-b-0 border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:border-purple-400 hover:text-purple-700"
              >
                + 신규추가
              </button>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {loading && (
              <div className="flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-bold text-purple-700 sm:text-sm">
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
                {loadingStep || "처리 중…"}
              </div>
            )}
            {result && (
              <button
                onClick={handleCopyReport}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all active:scale-95 ${
                  reportCopied
                    ? "bg-emerald-600"
                    : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {reportCopied ? "복사됨 ✓" : "결과 전체 복사"}
              </button>
            )}
          </div>
        </div>

        {/* 상단 가로 입력 바 — 처음 한 번만 쓰는 필드라 세로 컬럼 대신 가로로 */}
        <form
          onSubmit={handleSubmit}
          className="mb-4 grid shrink-0 grid-cols-1 gap-3 rounded-2xl rounded-tl-none border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)] md:grid-cols-2 xl:grid-cols-[1.1fr_1.1fr_120px_110px_110px_1.4fr_auto] xl:items-start"
        >
          <div>
            <label className="mb-1 block truncate text-xs font-semibold text-slate-600">
              청구 견적서 (필수, PDF)
              {estimateFile && (
                <span className="ml-2 font-normal text-slate-400">
                  {estimateFile.name}
                </span>
              )}
            </label>
            <input
              key={`est-${fileInputKey}`}
              type="file"
              accept="application/pdf"
              onChange={handleEstimateChange}
              className={fileInputClass}
            />
          </div>

          <div>
            <label className="mb-1 block truncate text-xs font-semibold text-slate-600">
              수리작업 사진 (필수, 여러 장)
              {photos.length > 0 && (
                <span className="ml-2 font-normal text-slate-400">
                  {photos.length}장
                </span>
              )}
            </label>
            <input
              key={`img-${fileInputKey}`}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImagesChange}
              className={fileInputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              차량번호
            </label>
            <input
              value={active?.plateNo ?? ""}
              onChange={(e) => updateActive({ plateNo: e.target.value })}
              className={textInputClass}
              placeholder="12가3456"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              제조사
            </label>
            <input
              value={active?.manufacturer ?? ""}
              onChange={(e) => updateActive({ manufacturer: e.target.value })}
              className={textInputClass}
              placeholder="현대"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              모델
            </label>
            <input
              value={active?.model ?? ""}
              onChange={(e) => updateActive({ model: e.target.value })}
              className={textInputClass}
              placeholder="아반떼"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              담당자 추가 의견(프롬프트 추가)
            </label>
            <input
              value={active?.memo ?? ""}
              onChange={(e) => updateActive({ memo: e.target.value })}
              placeholder="예: 이 부위는 재사용이 어려워 보임 / 사고 경위상 확인이 필요함"
              className={textInputClass}
            />
          </div>

          <div className="xl:pt-[20px]">
            <button
              type="submit"
              disabled={loading || !hydrated}
              className="h-[38px] w-full rounded-full bg-purple-600 px-6 text-sm font-bold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_16px_-4px_rgba(147,51,234,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-purple-700 hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_22px_-6px_rgba(147,51,234,0.55)] active:translate-y-0 active:scale-95 active:shadow-[0_2px_6px_rgba(147,51,234,0.4)_inset] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  처리 중
                </span>
              ) : (
                "AI 손해사정 시작"
              )}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="mb-4 shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[800px_980px] xl:items-stretch">
        {/* 좌: 수리작업 사진 + 청구 견적서 (800px 고정) */}
        <div className="flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
          {(imagePreviews.length > 0 || estimatePreviewUrl) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
              {imagePreviews.length > 0 && (
                <PhotoGrid
                  previews={imagePreviews}
                  label="수리작업 사진"
                  highlighted={highlightedPhotos}
                  accent="purple"
                  onOpen={setLightboxIndex}
                />
              )}

              {estimatePreviewUrl && (
                <div
                  className={
                    imagePreviews.length > 0
                      ? "mt-4 border-t border-slate-100 pt-4"
                      : ""
                  }
                >
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

          {!result && imagePreviews.length === 0 && !estimatePreviewUrl && (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]">
              <span aria-hidden="true" className="text-4xl opacity-50">
                ⚖️
              </span>
              <p className="text-sm text-slate-400">
                위에서 견적서와 수리작업 사진을 첨부하고 손해사정을 시작하면
                <br />이 자리에 사진과 청구서 미리보기가 표시됩니다.
              </p>
            </div>
          )}
        </div>

        {/* 우: 판넬 목록 → 하위 작업 판정(각각 독립 스크롤), 980px. 종합의견은 항목별 판정이 곧 결과라 없음 */}
        {result && diagnostics && active && (
          <div className="flex flex-col gap-4 xl:min-h-0">
            <div className="min-h-0 flex-1">
              <DiagnosticsPanel
                diagnostics={diagnostics}
                onHoverPhotos={setHighlightedPhotos}
                onOpenPhoto={(n) => {
                  if (n >= 1 && n <= imagePreviews.length)
                    setLightboxIndex(n - 1);
                }}
              />
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
