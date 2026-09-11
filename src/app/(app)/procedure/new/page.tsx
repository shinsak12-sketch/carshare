"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";
import dynamic from "next/dynamic";
import { ImageLightbox } from "@/components/ImageLightbox";
import { PhotoGrid } from "@/components/PhotoGrid";
import { ProcedureMasterDetail } from "@/components/ProcedureItemPanels";
import { compressImage } from "@/lib/image-compress";
import { buildProcedureReportText } from "@/lib/format-procedure-report";
import { buildProcedureReviewItems } from "@/lib/procedure-review-items";
import type { ProcedureResult } from "@/lib/procedure-types";
import {
  deleteProcedureCase,
  emptyProcedureCase,
  loadProcedureCases,
  loadProcedureFiles,
  procedureCaseTitle,
  saveProcedureCase,
  saveProcedureFiles,
  type StoredProcedureCase,
} from "@/lib/procedure-store";

// three.js는 브라우저 전용 — SSR 없이 동적 로드
const Car3DDiagram = dynamic(
  () => import("@/components/Car3DDiagram").then((m) => m.Car3DDiagram),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] w-full animate-pulse rounded-2xl bg-slate-100" />
    ),
  },
);

export default function NewProcedurePage() {
  // 건별 탭 — 손해사정·선견적과 같은 구조. 결과·사진은 IndexedDB에 캐시돼 새로고침해도 유지.
  const [cases, setCases] = useState<StoredProcedureCase[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const active = cases.find((c) => c.id === activeId) ?? null;

  const [photos, setPhotos] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [highlightedPhotos, setHighlightedPhotos] = useState<number[]>([]);
  const [reportCopied, setReportCopied] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  // 종합요약은 마지막에 보는 것 — 평소엔 한 줄로 접어두고 펼치면 우측 전체를 씀
  const [summaryOpen, setSummaryOpen] = useState(false);

  const result = active?.result ?? null;
  const reviewItems = useMemo(
    () => (result ? buildProcedureReviewItems(result) : []),
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadProcedureCases();
      if (cancelled) return;
      const list = stored.length ? stored : [emptyProcedureCase()];
      setCases(list);
      setActiveId(list[list.length - 1].id);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      const f = await loadProcedureFiles(activeId);
      if (cancelled) return;
      setPhotos(f.photos);
      setFileInputKey((k) => k + 1);
      setError(null);
      setHighlightedPhotos([]);
      setIsEditingSummary(false);
      setSummaryOpen(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const updateActive = useCallback(
    (patch: Partial<StoredProcedureCase>) => {
      if (!activeId) return;
      setCases((prev) => {
        const next = prev.map((c) =>
          c.id === activeId ? { ...c, ...patch } : c,
        );
        const updated = next.find((c) => c.id === activeId);
        if (updated) void saveProcedureCase(updated);
        return next;
      });
    },
    [activeId],
  );

  function addCase() {
    const c = emptyProcedureCase();
    setCases((prev) => [...prev, c]);
    void saveProcedureCase(c);
    setActiveId(c.id);
  }

  function removeCase(id: string) {
    setCases((prev) => {
      const next = prev.filter((c) => c.id !== id);
      const list = next.length ? next : [emptyProcedureCase()];
      if (!next.length) void saveProcedureCase(list[0]);
      if (id === activeId) setActiveId(list[list.length - 1].id);
      return list;
    });
    void deleteProcedureCase(id);
  }

  function handleImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setPhotos(files);
    updateActive({ photoCount: files.length });
    if (activeId)
      void saveProcedureFiles(activeId, { estimate: null, photos: files });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!active || !activeId) return;
    if (photos.length === 0) {
      setError("파손 사진을 1장 이상 첨부해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    updateActive({ result: null, caseInfo: null, summaryDraft: "" });

    const caseId = activeId;
    try {
      const total = photos.length;
      let uploadedCount = 0;
      setLoadingStep(`사진 업로드 중… (0/${total})`);

      // 손해사정·선견적과 같은 절차: 브라우저 → Vercel Blob 직접 업로드. 압축본을 캐시에도 씀.
      const CONCURRENCY = 6;
      const imageUrls: string[] = new Array(total);
      const compressed: File[] = new Array(total);
      let cursor = 0;
      async function worker() {
        while (cursor < total) {
          const i = cursor++;
          const c = await compressImage(photos[i]);
          compressed[i] = c;
          const blob = await upload(c.name, c, {
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
      void saveProcedureFiles(caseId, { estimate: null, photos: compressed });

      const formData = new FormData();
      formData.append("imageUrls", JSON.stringify(imageUrls));
      formData.append("manufacturer", active.manufacturer);
      formData.append("model", active.model);
      formData.append("memo", active.memo);

      setLoadingStep("AI 판단 중… (사진이 많으면 수 분 소요될 수 있음)");
      const res = await fetch("/api/procedure", {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`서버 오류 (${res.status}): ${text.slice(0, 200)}`);
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "요청에 실패했습니다.");
      const r = data.result as ProcedureResult;
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
                summaryDraft: r.overall_summary,
              }
            : c,
        );
        const updated = next.find((c) => c.id === caseId);
        if (updated) void saveProcedureCase(updated);
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
        buildProcedureReportText(active.caseInfo, active.result),
      );
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없는 브라우저 등 — 조용히 무시
    }
  }

  async function handleCopySummary() {
    try {
      await navigator.clipboard.writeText(active?.summaryDraft ?? "");
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 1500);
    } catch {
      // 조용히 무시
    }
  }

  const fileInputClass =
    "w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/40 px-3 py-1.5 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 file:shadow-sm file:transition-colors hover:border-orange-400 hover:file:bg-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20";
  const textInputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-150 outline-none focus:border-orange-500 focus:shadow-[inset_0_1px_3px_rgba(234,88,12,0.12)] focus:ring-2 focus:ring-orange-500/20";

  return (
    <main className="mx-auto flex max-w-[1880px] flex-col px-6 py-8 lg:py-10 xl:h-[calc(100dvh-57px)] xl:py-4">
      {/* 제목 + 탭 바 + 입력 바 — 틀 고정 */}
      <div className="sticky top-0 z-30 -mx-6 shrink-0 bg-[var(--background)] px-6 pt-1 xl:pt-0">
        <div className="mb-3 flex shrink-0 items-end justify-between gap-4">
          <div className="flex min-w-0 items-end gap-4">
            <h1 className="shrink-0 text-2xl font-bold text-slate-900 lg:text-3xl">
              정비공정 판단
            </h1>
            <div className="flex min-w-0 items-end gap-1 overflow-x-auto">
              {cases.map((c, i) => {
                const isActive = c.id === activeId;
                return (
                  <div
                    key={c.id}
                    className={`group flex shrink-0 items-center gap-1.5 rounded-t-xl border border-b-0 px-3.5 py-2 text-xs font-bold transition-colors ${
                      isActive
                        ? "border-orange-300 bg-white text-orange-700 shadow-[0_-4px_12px_-8px_rgba(234,88,12,0.4)]"
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
                      {procedureCaseTitle(c, i)}
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
                className="shrink-0 rounded-t-xl border border-b-0 border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:border-orange-400 hover:text-orange-700"
              >
                + 신규추가
              </button>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {loading && (
              <div className="flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-700 sm:text-sm">
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-orange-300 border-t-orange-600" />
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

        {/* 상단 가로 입력 바 — 선견적 없이 사진만 */}
        <form
          onSubmit={handleSubmit}
          className="mb-4 grid shrink-0 grid-cols-1 gap-3 rounded-2xl rounded-tl-none border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)] md:grid-cols-2 xl:grid-cols-[1.4fr_120px_110px_110px_2fr_auto] xl:items-start"
        >
          <div>
            <label className="mb-1 block truncate text-xs font-semibold text-slate-600">
              파손 사진 (필수, 여러 장)
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
              제조사 (선택)
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
              모델 (선택)
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
              메모 (선택, 프롬프트 추가)
            </label>
            <input
              value={active?.memo ?? ""}
              onChange={(e) => updateActive({ memo: e.target.value })}
              placeholder="예: 사고 경위, 확인이 필요한 부분 등"
              className={textInputClass}
            />
          </div>

          <div className="xl:pt-[20px]">
            <button
              type="submit"
              disabled={loading || !hydrated}
              className="h-[38px] w-full rounded-full bg-orange-600 px-6 text-sm font-bold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_16px_-4px_rgba(234,88,12,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-orange-700 hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_22px_-6px_rgba(234,88,12,0.55)] active:translate-y-0 active:scale-95 active:shadow-[0_2px_6px_rgba(234,88,12,0.4)_inset] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  처리 중
                </span>
              ) : (
                "AI 판단 시작"
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
        {/* 좌: 파손 사진 + 손상 위치 도해 + 작업 공정 (800px 고정, 스크롤) */}
        <div className="flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
          {imagePreviews.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
              <PhotoGrid
                previews={imagePreviews}
                label="파손 사진"
                highlighted={highlightedPhotos}
                accent="orange"
                onOpen={setLightboxIndex}
              />
            </div>
          )}

          {result && (
            <>
              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
                <h3 className="text-center text-sm font-bold text-slate-900">
                  손상 위치 도해
                </h3>
                <Car3DDiagram
                  damagedParts={result.damaged_parts}
                  suspectedHiddenDamage={result.suspected_hidden_damage}
                />
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
                <h3 className="text-sm font-bold text-slate-900">작업 공정</h3>
                {result.process_stages.map((stage, i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-slate-50 p-4 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-600 text-[12px] font-bold text-white">
                        {i + 1}
                      </span>
                      <p className="text-sm font-bold text-slate-900">
                        {stage.stage_name}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-col gap-2.5 border-l-2 border-orange-200 pl-4">
                      {stage.steps.map((step, j) => (
                        <div key={j}>
                          <p className="text-sm font-bold text-slate-800">
                            {step.title}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-slate-600">
                            {step.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!result && imagePreviews.length === 0 && (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]">
              <span aria-hidden="true" className="text-4xl opacity-50">
                🛠️
              </span>
              <p className="text-sm text-slate-400">
                위에서 파손 사진을 첨부하고 판단을 시작하면
                <br />이 자리에 사진·손상 도해·작업 공정이 표시됩니다.
              </p>
            </div>
          )}
        </div>

        {/* 우: 검토 항목 마스터-디테일(위) + 종합요약(아래), 980px */}
        {result && active && (
          <div className="flex flex-col gap-4 xl:min-h-0">
            {!summaryOpen && (
              <div className="min-h-0 flex-1">
                <ProcedureMasterDetail
                  items={reviewItems}
                  onHoverPhotos={setHighlightedPhotos}
                  onOpenPhoto={(n) => {
                    if (n >= 1 && n <= imagePreviews.length)
                      setLightboxIndex(n - 1);
                  }}
                />
              </div>
            )}

            {!summaryOpen && (
              <button
                type="button"
                onClick={() => setSummaryOpen(true)}
                className="group flex shrink-0 items-center justify-between gap-3 rounded-2xl bg-slate-900 px-5 py-3 text-left text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-10px_rgba(15,23,42,0.65)] active:translate-y-0 active:scale-[0.995]"
              >
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  종합 요약
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white transition-colors group-hover:bg-white/25">
                  펼쳐서 보기 ▴
                </span>
              </button>
            )}

            {summaryOpen && (
              <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-slate-900 px-5 py-3.5 text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)]">
                <div className="flex shrink-0 items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    종합 요약
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => setIsEditingSummary((v) => !v)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all active:scale-95 ${
                        isEditingSummary
                          ? "bg-emerald-600"
                          : "bg-white/15 hover:bg-white/25"
                      }`}
                    >
                      {isEditingSummary ? "완료" : "편집"}
                    </button>
                    <button
                      onClick={handleCopySummary}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all active:scale-95 ${
                        summaryCopied
                          ? "bg-emerald-600"
                          : "bg-white/15 hover:bg-white/25"
                      }`}
                    >
                      {summaryCopied ? "복사됨 ✓" : "복사"}
                    </button>
                    <button
                      onClick={() => setSummaryOpen(false)}
                      className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-white/25 active:scale-95"
                    >
                      검토 항목으로 ▾
                    </button>
                  </div>
                </div>
                {isEditingSummary ? (
                  <textarea
                    value={active.summaryDraft}
                    onChange={(e) =>
                      updateActive({ summaryDraft: e.target.value })
                    }
                    className="mt-1.5 min-h-0 w-full flex-1 resize-none rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium leading-relaxed text-white outline-none focus:border-white/40"
                  />
                ) : (
                  <p className="mt-1.5 min-h-0 flex-1 overflow-y-auto whitespace-pre-line text-sm font-medium leading-relaxed text-slate-100">
                    {active.summaryDraft}
                  </p>
                )}
              </div>
            )}
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
