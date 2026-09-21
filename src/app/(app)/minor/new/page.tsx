"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CarPanelDiagram } from "@/components/CarPanelDiagram";
import {
  CLASS_HEX,
  ConditionSummary,
  DamageLayerDiagram,
  TypeStepper,
} from "@/components/MinorVisuals";
import { ImageLightbox } from "@/components/ImageLightbox";
import { PhotoGrid } from "@/components/PhotoGrid";
import { uploadPhotos } from "@/lib/upload-photos";
import { JobFailedError, postToolForm, runAiJob } from "@/lib/ai-job-client";
import {
  buildMinorReportText,
  minorPartHeading,
} from "@/lib/format-minor-report";
import {
  MINOR_CLASS_LABEL,
  type MinorClass,
  type MinorPartInput,
  type MinorPartResult,
  type MinorResult,
} from "@/lib/minor-types";
import {
  deleteMinorCase,
  emptyMinorCase,
  loadMinorCases,
  loadMinorFiles,
  minorCaseTitle,
  saveMinorCase,
  saveMinorFiles,
  type StoredMinorCase,
} from "@/lib/minor-store";

// 유형별 색 — 1·2유형(도막) 파랑 계열, 3유형(소재 복원) 주황, 기타손상(교환) 빨강, 손상없음 초록, 판독불가 회색
const CLASS_STYLE: Record<MinorClass, { badge: string; bar: string }> = {
  "1유형": { badge: "bg-sky-600 text-white", bar: "bg-sky-500" },
  "2유형": { badge: "bg-blue-600 text-white", bar: "bg-blue-500" },
  "3유형": { badge: "bg-amber-500 text-white", bar: "bg-amber-500" },
  기타손상: { badge: "bg-red-600 text-white", bar: "bg-red-500" },
  손상없음: { badge: "bg-emerald-600 text-white", bar: "bg-emerald-500" },
  판독불가: { badge: "bg-slate-500 text-white", bar: "bg-slate-400" },
};
const STATUS_STYLE: Record<string, string> = {
  해당: "bg-red-100 text-red-800 border-red-200",
  "해당 없음": "bg-slate-100 text-slate-500 border-slate-200",
  "확인 불가": "bg-amber-100 text-amber-800 border-amber-200",
};
const CONF_STYLE: Record<string, string> = {
  높음: "text-emerald-700 bg-emerald-50 border-emerald-200",
  중간: "text-amber-700 bg-amber-50 border-amber-200",
  낮음: "text-red-700 bg-red-50 border-red-200",
};

const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

export default function NewMinorPage() {
  const [cases, setCases] = useState<StoredMinorCase[]>([]);
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
  const [copiedPart, setCopiedPart] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(true);

  const result = active?.result ?? null;

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
      const stored = await loadMinorCases();
      if (cancelled) return;
      const list = stored.length ? stored : [emptyMinorCase()];
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
      const f = await loadMinorFiles(activeId);
      if (cancelled) return;
      setPhotos(f.photos);
      setFileInputKey((k) => k + 1);
      setError(null);
      setHighlightedPhotos([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // 결과를 원래 건에 저장(분석 도중 다른 탭으로 옮겼어도 원래 건에). 새로고침 후 이어받을 때도 씀
  function storeResult(caseId: string, raw: MinorResult) {
    // 모델이 이름에 "(좌)"를 붙여 보내는 경우가 있어 side와 겹치지 않게 떼어냄
    const r: MinorResult = {
      ...raw,
      parts: raw.parts.map((p) => ({
        ...p,
        part_name: p.part_name.replace(/\s*[(（](좌|우|중앙)[)）]\s*$/, ""),
      })),
    };
    setCases((prev) => {
      const next = prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              result: r,
              jobId: null,
              jobImageUrls: [],
              caseInfo: {
                manufacturer: c.manufacturer || undefined,
                model: c.model || undefined,
                year: c.year || undefined,
                plateNo: c.plateNo || undefined,
                memo: c.memo || undefined,
                parts: c.parts,
              },
            }
          : c,
      );
      const updated = next.find((c) => c.id === caseId);
      if (updated) void saveMinorCase(updated);
      return next;
    });
  }

  function markJob(caseId: string, jobId: string, jobImageUrls: string[]) {
    setCases((prev) => {
      const next = prev.map((c) =>
        c.id === caseId ? { ...c, jobId, jobImageUrls } : c,
      );
      const updated = next.find((c) => c.id === caseId);
      if (updated) void saveMinorCase(updated);
      return next;
    });
  }

  // 로드 시 진행 중이던 작업 이어받기
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || resumedRef.current) return;
    resumedRef.current = true;
    const pending = cases.filter(
      (c): c is typeof c & { jobId: string } => !!c.jobId && !c.result,
    );
    if (!pending.length) return;
    const timer = setTimeout(() => {
      for (const c of pending) {
        const caseId = c.id;
        setLoading(true);
        runAiJob<MinorResult>(
          { jobId: c.jobId },
          c.jobImageUrls ?? [],
          setLoadingStep,
          undefined,
          "AI 판독 중(이어받기)",
          (r) => storeResult(caseId, r),
        )
          .catch((err) => {
            if (
              err instanceof JobFailedError &&
              err.code === "already_collected"
            ) {
              void loadMinorCases().then(setCases);
              return;
            }
            setError(
              err instanceof Error
                ? err.message
                : "알 수 없는 오류가 발생했습니다.",
            );
            if (!(err instanceof JobFailedError)) return;
            setCases((prev) => {
              const next = prev.map((x) =>
                x.id === caseId ? { ...x, jobId: null, jobImageUrls: [] } : x,
              );
              const updated = next.find((x) => x.id === caseId);
              if (updated) void saveMinorCase(updated);
              return next;
            });
          })
          .finally(() => {
            setLoading(false);
            setLoadingStep("");
          });
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const updateActive = useCallback(
    (patch: Partial<StoredMinorCase>) => {
      if (!activeId) return;
      setCases((prev) => {
        const next = prev.map((c) =>
          c.id === activeId ? { ...c, ...patch } : c,
        );
        const updated = next.find((c) => c.id === activeId);
        if (updated) void saveMinorCase(updated);
        return next;
      });
    },
    [activeId],
  );

  function addCase() {
    const c = emptyMinorCase();
    setCases((prev) => [...prev, c]);
    void saveMinorCase(c);
    setActiveId(c.id);
  }

  function removeCase(id: string) {
    setCases((prev) => {
      const next = prev.filter((c) => c.id !== id);
      const list = next.length ? next : [emptyMinorCase()];
      if (!next.length) void saveMinorCase(list[0]);
      if (id === activeId) setActiveId(list[list.length - 1].id);
      return list;
    });
    void deleteMinorCase(id);
  }

  // 사진은 고를 때마다 덧붙임(같은 파일은 한 번만). 빼는 건 그리드의 X 버튼
  function handleImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (!picked.length) return;
    const seen = new Set(photos.map(fileKey));
    const added = picked.filter((f) => {
      const k = fileKey(f);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    applyPhotos([...photos, ...added]);
  }

  function handleRemovePhoto(index: number) {
    applyPhotos(photos.filter((_, i) => i !== index));
  }

  function applyPhotos(next: File[]) {
    setPhotos(next);
    updateActive({ photoCount: next.length });
    if (activeId)
      void saveMinorFiles(activeId, { estimate: null, photos: next });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!active || !activeId) return;
    if (active.parts.length === 0) {
      setError("도해도에서 판독할 부위를 하나 이상 선택해주세요.");
      return;
    }
    if (photos.length === 0) {
      setError("외판 사진을 1장 이상 첨부해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setFormOpen(false);
    updateActive({ result: null, caseInfo: null });

    const caseId = activeId;
    const parts: MinorPartInput[] = active.parts;
    try {
      const { urls: imageUrls, compressed } = await uploadPhotos(
        photos,
        setLoadingStep,
      );
      void saveMinorFiles(caseId, { estimate: null, photos: compressed });

      const formData = new FormData();
      formData.append("imageUrls", JSON.stringify(imageUrls));
      formData.append("parts", JSON.stringify(parts));
      formData.append("manufacturer", active.manufacturer);
      formData.append("model", active.model);
      formData.append("year", active.year);
      formData.append("memo", active.memo);
      formData.append("plateNo", active.plateNo ?? "");

      setLoadingStep("AI 판독 중…");
      const data = await postToolForm<MinorResult>(
        "/api/minor",
        formData,
        "사진",
      );
      await runAiJob<MinorResult>(
        data,
        imageUrls,
        setLoadingStep,
        (jobId) => markJob(caseId, jobId, imageUrls),
        "AI 판독 중",
        (r) => storeResult(caseId, r),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  }

  async function copyText(text: string, done: () => void) {
    try {
      await navigator.clipboard.writeText(text);
      done();
    } catch {
      // 클립보드 권한이 없는 브라우저 등 — 조용히 무시
    }
  }

  function handleCopyReport() {
    if (!active?.result || !active.caseInfo) return;
    void copyText(buildMinorReportText(active.caseInfo, active.result), () => {
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 1500);
    });
  }

  function handleCopyPart(i: number, p: MinorPartResult) {
    void copyText(p.report_text, () => {
      setCopiedPart(i);
      setTimeout(() => setCopiedPart(null), 1500);
    });
  }

  function openPhoto(n: number) {
    if (n >= 1 && n <= imagePreviews.length) setLightboxIndex(n - 1);
  }

  const fileInputClass =
    "w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/40 px-3 py-1.5 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 file:shadow-sm file:transition-colors hover:border-emerald-400 hover:file:bg-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";
  const textInputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-150 outline-none focus:border-emerald-500 focus:shadow-[inset_0_1px_3px_rgba(5,150,105,0.12)] focus:ring-2 focus:ring-emerald-500/20";
  const card =
    "rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]";

  return (
    <main className="mx-auto flex max-w-[1880px] flex-col overflow-x-clip px-6 py-8 lg:py-10 xl:h-[calc(100dvh-57px)] xl:py-4">
      <div className="sticky top-0 z-30 -mx-6 shrink-0 bg-[var(--background)] px-6 pt-1 xl:pt-0">
        <div className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-end gap-4">
            <h1 className="shrink-0 text-2xl font-bold text-slate-900 lg:text-3xl">
              경미손상판독기
            </h1>
            <div className="flex min-w-0 items-end gap-1 overflow-x-auto">
              {cases.map((c, i) => {
                const isActive = c.id === activeId;
                return (
                  <div
                    key={c.id}
                    className={`group flex shrink-0 items-center gap-1.5 rounded-t-xl border border-b-0 px-3.5 py-2 text-xs font-bold transition-colors ${
                      isActive
                        ? "border-emerald-300 bg-white text-emerald-700 shadow-[0_-4px_12px_-8px_rgba(5,150,105,0.4)]"
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
                      {minorCaseTitle(c, i)}
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
                className="shrink-0 rounded-t-xl border border-b-0 border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:border-emerald-400 hover:text-emerald-700"
              >
                + 신규추가
              </button>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFormOpen((v) => !v)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-95 xl:hidden"
            >
              {formOpen ? "입력 접기 ▴" : "입력 펼치기 ▾"}
            </button>
            {loading && (
              <div className="flex min-w-0 max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 sm:text-sm">
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
                <span className="min-w-0 truncate">
                  {loadingStep || "처리 중…"}
                </span>
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
            {result && active && (
              <a
                href={`/minor/report?case=${encodeURIComponent(active.id)}`}
                target="_blank"
                rel="noopener"
                title="인쇄용 보고서를 새 탭에서 열고 브라우저 인쇄에서 PDF로 저장"
                className="shrink-0 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 active:scale-95"
              >
                🖨 보고서 · PDF
              </a>
            )}
          </div>
        </div>

        {/* 상단 입력 바 — 사진 + 차량정보. 부위는 아래 도해도에서 */}
        <form
          onSubmit={handleSubmit}
          className={`mb-4 grid shrink-0 grid-cols-1 gap-3 rounded-2xl rounded-tl-none border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)] md:grid-cols-2 xl:grid-cols-[1.4fr_120px_110px_110px_90px_2fr_auto] xl:items-start ${formOpen ? "" : "hidden xl:grid"}`}
        >
          <div>
            <label className="mb-1 block truncate text-xs font-semibold text-slate-600">
              외판 사진 (필수, 여러 장)
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
              연식 (선택)
            </label>
            <input
              value={active?.year ?? ""}
              onChange={(e) => updateActive({ year: e.target.value })}
              className={textInputClass}
              placeholder="2021"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              메모 (선택, 프롬프트 추가)
            </label>
            <input
              value={active?.memo ?? ""}
              onChange={(e) => updateActive({ memo: e.target.value })}
              placeholder="예: 사고 경위, 상대측 주장 등"
              className={textInputClass}
            />
          </div>
          <div className="xl:pt-[20px]">
            <button
              type="submit"
              disabled={loading || !hydrated}
              className="h-[38px] w-full rounded-full bg-emerald-600 px-6 text-sm font-bold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_16px_-4px_rgba(5,150,105,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_22px_-6px_rgba(5,150,105,0.55)] active:translate-y-0 active:scale-95 active:shadow-[0_2px_6px_rgba(5,150,105,0.4)_inset] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  처리 중
                </span>
              ) : (
                "AI 판독 시작"
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

      <div className="grid grid-cols-1 gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[720px_minmax(0,1fr)] xl:items-stretch">
        {/* 좌: 도해도(부위 선택) + 사진 */}
        <div className="flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
          <div className={`${card} p-4`}>
            <CarPanelDiagram
              value={active?.parts ?? []}
              onChange={(parts) => updateActive({ parts })}
              disabled={loading || !active}
            />
          </div>

          {imagePreviews.length > 0 && (
            <div className={`${card} p-4`}>
              <PhotoGrid
                previews={imagePreviews}
                onRemove={loading ? undefined : handleRemovePhoto}
                label="외판 사진"
                highlighted={highlightedPhotos}
                accent="emerald"
                onOpen={setLightboxIndex}
                columns={8}
              />
            </div>
          )}
        </div>

        {/* 우: 부위별 판독 결과 */}
        <div className="flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
          {!result && (
            <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]">
              <span aria-hidden="true" className="text-4xl opacity-50">
                🔍
              </span>
              <p className="text-sm leading-relaxed text-slate-400">
                도해도에서 부위를 고르고 사진을 첨부한 뒤 판독을 시작하면
                <br />
                부위별로 경미손상 유형(1·2·3유형 / 기타손상)과 기준상 수리방법,
                <br />
                교환 조건 해당 여부, 거래처·고객용 회신문이 표시됩니다.
              </p>
              <p className="text-[11px] text-slate-400">
                근거: 자동차보험 표준약관 별표 2 · 보험개발원 경미손상 수리기준.
                청구·공정·금액은 다루지 않음.
              </p>
            </div>
          )}

          {result && result.vehicle_note && (
            <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-[inset_0_1px_2px_rgba(217,119,6,0.1)]">
              <span className="mr-1.5 font-bold">차량·사진 메모</span>
              {result.vehicle_note}
            </div>
          )}

          {result &&
            result.parts.map((p, i) => {
              const cs = CLASS_STYLE[p.classification] ?? CLASS_STYLE.판독불가;
              return (
                <section
                  key={`${p.part_name}-${p.side}-${i}`}
                  className={`${card} shrink-0 overflow-hidden`}
                  onMouseEnter={() => setHighlightedPhotos(p.photo_refs)}
                  onMouseLeave={() => setHighlightedPhotos([])}
                >
                  <div className={`h-1.5 ${cs.bar}`} />
                  <div className="flex flex-col gap-4 p-5">
                    {/* 머리: 부위 + 유형 배지 */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white shadow-sm">
                          {i + 1}
                        </span>
                        <div>
                          <h3 className="text-base font-black text-slate-900">
                            {minorPartHeading(p)}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-black shadow-sm ${cs.badge}`}
                            >
                              {MINOR_CLASS_LABEL[p.classification] ??
                                p.classification}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${CONF_STYLE[p.evidence_confidence] ?? ""}`}
                            >
                              근거 확신 {p.evidence_confidence}
                            </span>
                            {p.photo_refs.length > 0 && (
                              <span className="font-mono text-[10px] text-slate-400">
                                사진 {p.photo_refs.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyPart(i, p)}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all active:scale-95 ${
                          copiedPart === i
                            ? "bg-emerald-600"
                            : "bg-slate-900 hover:bg-slate-800"
                        }`}
                      >
                        {copiedPart === i ? "복사됨 ✓" : "회신문 복사"}
                      </button>
                    </div>

                    {/* 손상 깊이 단면 + 유형 단계 + 판정 근거 */}
                    <div className="grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-3 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
                      <div className="rounded-xl bg-white p-2 shadow-sm">
                        <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-400">
                          손상 깊이
                        </p>
                        <DamageLayerDiagram cls={p.classification} />
                      </div>
                      <div className="flex flex-col gap-2.5">
                        <TypeStepper cls={p.classification} />
                        <div
                          className="rounded-xl border-l-4 bg-white px-3.5 py-2.5 shadow-sm"
                          style={{ borderColor: CLASS_HEX[p.classification] }}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            판정 근거
                          </p>
                          <p className="mt-0.5 text-[15px] font-black leading-snug text-slate-900">
                            {p.key_evidence}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {/* 관찰 */}
                      <div>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          사진에서 보이는 것
                        </p>
                        {p.observations.length === 0 ? (
                          <p className="text-xs text-slate-400">관찰 없음</p>
                        ) : (
                          <ul className="flex flex-col gap-1.5">
                            {p.observations.map((o, j) => (
                              <li
                                key={j}
                                className="flex items-start gap-2 text-xs leading-relaxed text-slate-700"
                              >
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                <span>
                                  <span className="font-bold text-slate-900">
                                    {o.what}
                                  </span>
                                  <span className="text-slate-500">
                                    {" "}
                                    · {o.location}
                                  </span>
                                  {o.photo_refs.length > 0 && (
                                    <span className="ml-1 inline-flex gap-0.5">
                                      {o.photo_refs.map((n) => (
                                        <button
                                          key={n}
                                          type="button"
                                          onClick={() => openPhoto(n)}
                                          onMouseEnter={() =>
                                            setHighlightedPhotos([n])
                                          }
                                          onMouseLeave={() =>
                                            setHighlightedPhotos(p.photo_refs)
                                          }
                                          className="rounded bg-slate-100 px-1 font-mono text-[10px] font-bold text-slate-600 transition-colors hover:bg-emerald-100 hover:text-emerald-800"
                                        >
                                          {n}
                                        </button>
                                      ))}
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* 교환 조건 */}
                      <div>
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            교환 조건 대조
                          </p>
                          <ConditionSummary
                            conditions={p.exchange_conditions}
                          />
                        </div>
                        {p.exchange_conditions.length === 0 ? (
                          <p className="text-xs text-slate-400">대조 없음</p>
                        ) : (
                          <ul className="flex flex-col gap-1">
                            {p.exchange_conditions.map((c, j) => (
                              <li
                                key={j}
                                className={`flex items-start gap-2 rounded-lg px-2 py-1 text-xs leading-relaxed ${
                                  c.status === "해당" ? "bg-red-50" : ""
                                }`}
                              >
                                <span
                                  className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-px text-[10px] font-bold ${STATUS_STYLE[c.status] ?? ""}`}
                                >
                                  {c.status}
                                </span>
                                <span className="text-slate-700">
                                  <span
                                    className={
                                      c.status === "해당"
                                        ? "font-bold text-red-900"
                                        : "font-semibold text-slate-800"
                                    }
                                  >
                                    {c.condition}
                                  </span>
                                  {c.note && (
                                    <span className="text-slate-500">
                                      {" "}
                                      — {c.note}
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* 수리방법 */}
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        기준상 수리방법
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-emerald-950">
                        {p.repair_method}
                      </p>
                    </div>

                    {p.additional_photos.length > 0 && (
                      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          추가로 확인이 필요한 사진
                        </p>
                        <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed text-amber-900">
                          {p.additional_photos.map((a, j) => (
                            <li key={j}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 회신문 */}
                    <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)]">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        거래처·고객 회신문
                      </p>
                      <p className="mt-1.5 whitespace-pre-line text-sm font-medium leading-relaxed text-slate-100">
                        {p.report_text}
                      </p>
                    </div>
                  </div>
                </section>
              );
            })}

          {result && (
            <p className="shrink-0 px-1 pb-2 text-[11px] text-slate-400">
              근거: 자동차보험 표준약관 제21조 제4항·별표 2, 보험개발원
              자동차기술연구소 경미손상 수리기준. AI 보조 의견이며 최종 판단은
              담당자가 합니다.
            </p>
          )}
        </div>
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
