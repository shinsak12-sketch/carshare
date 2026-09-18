"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageLightbox } from "@/components/ImageLightbox";
import { PhotoGrid } from "@/components/PhotoGrid";
import { DiagnosticsTree } from "@/components/DiagnosticsTree";
import { EstimateTreeView, judgmentKey } from "@/components/EstimateTree";
import { isEstimateTree, type EstimateTree } from "@/lib/estimate-tree";
import { uploadPhotos } from "@/lib/upload-photos";
import { JobFailedError, postToolForm, runAiJob } from "@/lib/ai-job-client";
import { OpinionEditor } from "@/components/OpinionEditor";
import type { AssessmentResult } from "@/lib/assessment-types";
import { buildReportText, splitOpinionItems } from "@/lib/format-report";
import { buildAssessmentDiagnostics } from "@/lib/assessment-diagnostics";
import type { ItemDiagnostic } from "@/lib/adjustment-review-items";
import {
  caseTitle,
  deleteCase,
  emptyCase,
  loadCases,
  loadFiles,
  saveCase,
  saveFiles,
  type StoredCase,
} from "@/lib/assessment-v2-store";

export default function NewAssessPage() {
  // 건별 탭 — 엑셀 시트처럼. 결과·사진·선견적은 IndexedDB에 캐시돼 새로고침해도 유지.
  // 손해사정(새 디자인)과 같은 화면 구조. 프롬프트·API·결과 타입만 선견적 것.
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
  // 라이트박스가 넘겨보는 사진 묶음. null = 전체 사진, 배열 = 특정 항목의 근거사진 번호(1부터)만.
  // 근거사진 번호를 눌러 열면 ‹ › 가 그 항목 근거사진 안에서만 돌아 닫았다 다시 여는 수고를 덜어줌.
  const [lightboxSet, setLightboxSet] = useState<{
    photos: number[];
    title: string;
  } | null>(null);
  // 사진 그리드 접기(100장 넘게 붙으면 표가 아래로 밀리니까)
  const [photosOpen, setPhotosOpen] = useState(true);
  // 종합의견(거래처 발신용) 편집 패널 — 열면 표 아래 전체 폭으로 펼쳐짐
  const [opinionOpen, setOpinionOpen] = useState(false);

  const result = active?.result ?? null;
  // 결과 → 판정 트리 + 견적서 행(line_no) → 판정 색인. 색인은 견적서 표 옆에
  // 판정 열로 붙여 보여주기 위한 것. (수동 useMemo 없이 React Compiler에 맡김)
  const diagnostics = result ? buildAssessmentDiagnostics(result) : null;
  const judgmentMap = new Map<string, ItemDiagnostic>(
    (diagnostics?.branches ?? [])
      .flatMap((b) => [b.main, ...b.children])
      .filter((d): d is ItemDiagnostic => !!d && d.lineNo != null)
      .map((d) => [judgmentKey(d.lineNo), d] as const),
  );
  // 결과 + 구조화된 견적서가 있으면 표 하나에 판정을 인라인으로 → 우측 패널 없이 전체 폭 사용.
  // (견적서 표가 없을 때만 예전처럼 우측에 트리 출력)
  const inlineJudged = !!result && isEstimateTree(active?.estimateTree);

  const imagePreviews = useMemo(
    () => photos.map((f) => ({ url: URL.createObjectURL(f) })),
    [photos],
  );
  useEffect(
    () => () => imagePreviews.forEach((p) => URL.revokeObjectURL(p.url)),
    [imagePreviews],
  );
  // 근거사진 번호(1부터) 클릭 → 그 항목의 근거사진 묶음만 라이트박스로
  function openEvidencePhoto(n: number, refs?: number[], itemName?: string) {
    if (n < 1 || n > imagePreviews.length) return;
    const valid = (refs ?? []).filter(
      (r) => r >= 1 && r <= imagePreviews.length,
    );
    if (valid.length > 1) {
      setLightboxSet({
        photos: valid,
        title: `${itemName ?? ""} 근거사진`.trim(),
      });
      setLightboxIndex(valid.indexOf(n));
    } else {
      setLightboxSet(null);
      setLightboxIndex(n - 1);
    }
  }
  const [highlightedPhotos, setHighlightedPhotos] = useState<number[]>([]);
  const [showEstimate, setShowEstimate] = useState(true);
  const [showPdf, setShowPdf] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);
  // 모바일에선 틀 고정된 입력바가 화면을 너무 차지해서 접을 수 있게 (xl 이상은 항상 펼침)
  const [formOpen, setFormOpen] = useState(true);

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

  // 결과를 원래 건에 저장(분석 도중 다른 탭으로 옮겼어도 원래 건에). 새로고침 후 이어받을 때도 씀
  function storeResult(caseId: string, r: AssessmentResult) {
    setCases((prev) => {
      const next = prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              result: r,
              jobId: null,
              jobImageUrls: [],
              caseInfo: {
                manufacturer: c.manufacturer,
                model: c.model,
                year: c.year.trim() ? Number(c.year) : undefined,
              },
              opinionEdits: { excluded: [], text: {} },
            }
          : c,
      );
      const updated = next.find((c) => c.id === caseId);
      if (updated) void saveCase(updated);
      return next;
    });
  }

  // 백그라운드 작업 ID를 건에 기록 — 새로고침해도 결과를 이어받기 위함
  function markJob(caseId: string, jobId: string, jobImageUrls: string[]) {
    setCases((prev) => {
      const next = prev.map((c) =>
        c.id === caseId ? { ...c, jobId, jobImageUrls } : c,
      );
      const updated = next.find((c) => c.id === caseId);
      if (updated) void saveCase(updated);
      return next;
    });
  }

  // 로드 시 진행 중이던 작업 이어받기 (OpenAI 쪽에서 계속 돌고 있음)
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || resumedRef.current) return;
    resumedRef.current = true;
    const pending = cases.filter(
      (c): c is typeof c & { jobId: string } => !!c.jobId && !c.result,
    );
    if (!pending.length) return;
    // effect 본문에서 직접 setState 하지 않고 다음 틱에서 시작
    const timer = setTimeout(() => {
      for (const c of pending) {
        const caseId = c.id;
        setLoading(true);
        runAiJob<AssessmentResult>(
          { jobId: c.jobId },
          c.jobImageUrls ?? [],
          setLoadingStep,
          undefined,
          "AI 진단 중(이어받기)",
          (r) => storeResult(caseId, r),
        )
          .catch((err) => {
            // 다른 탭이 이미 받아 저장한 건 — 이 탭은 저장된 결과를 다시 읽기만
            if (
              err instanceof JobFailedError &&
              err.code === "already_collected"
            ) {
              void loadCases().then(setCases);
              return;
            }
            setError(
              err instanceof Error
                ? err.message
                : "알 수 없는 오류가 발생했습니다.",
            );
            // 확정 실패만 이어받기 정보를 지움. 일시 오류면 남겨 둬서 새로고침으로 다시 이어받게
            if (!(err instanceof JobFailedError)) return;
            setCases((prev) => {
              const next = prev.map((x) =>
                x.id === caseId ? { ...x, jobId: null, jobImageUrls: [] } : x,
              );
              const updated = next.find((x) => x.id === caseId);
              if (updated) void saveCase(updated);
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

  async function handleEstimateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const caseId = activeId;
    setEstimateFile(file);
    setShowEstimate(true);
    updateActive({
      estimateName: file.name,
      estimateTree: null,
      estimateTreeStatus: "parsing",
    });
    if (caseId) void saveFiles(caseId, { estimate: file, photos });

    // [실험] 견적서를 트리로 구조화 (텍스트만, 사진 없음)
    try {
      const fd = new FormData();
      fd.append("estimate", file);
      const res = await fetch("/api/estimate-tree", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "견적서 구조화에 실패했습니다.");
      const tree = data.tree as EstimateTree;
      setCases((prev) => {
        const next = prev.map((c) =>
          c.id === caseId
            ? { ...c, estimateTree: tree, estimateTreeStatus: "idle" as const }
            : c,
        );
        const updated = next.find((c) => c.id === caseId);
        if (updated) void saveCase(updated);
        return next;
      });
    } catch (err) {
      setCases((prev) =>
        prev.map((c) =>
          c.id === caseId ? { ...c, estimateTreeStatus: "error" as const } : c,
        ),
      );
      setError(
        err instanceof Error ? err.message : "견적서 구조화에 실패했습니다.",
      );
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!active || !activeId) return;
    if (photos.length === 0) {
      setError("파손 사진을 1장 이상 첨부해주세요.");
      return;
    }
    if (!active.manufacturer.trim() || !active.model.trim()) {
      setError("제조사와 모델을 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setFormOpen(false);
    updateActive({
      result: null,
      caseInfo: null,
      opinionEdits: { excluded: [], text: {} },
    });

    const caseId = activeId;
    try {
      const { urls: imageUrls, compressed: compressedFiles } =
        await uploadPhotos(photos, setLoadingStep);
      void saveFiles(caseId, {
        estimate: estimateFile,
        photos: compressedFiles,
      });

      const formData = new FormData();
      if (estimateFile) formData.append("estimate", estimateFile);
      formData.append("manufacturer", active.manufacturer);
      formData.append("model", active.model);
      if (active.year.trim()) formData.append("year", active.year.trim());
      formData.append("memo", active.memo);
      formData.append("plateNo", active.plateNo ?? "");
      formData.append("imageUrls", JSON.stringify(imageUrls));

      setLoadingStep("AI 진단 중… (사진이 많으면 수 분 소요될 수 있음)");
      const data = await postToolForm<AssessmentResult>(
        "/api/assess",
        formData,
        "선견적(PDF)",
      );
      const r = await runAiJob<AssessmentResult>(
        data,
        imageUrls,
        setLoadingStep,
        (jobId) => markJob(caseId, jobId, imageUrls),
        "AI 진단 중",
        (r) => storeResult(caseId, r),
      );
      void r;
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
        buildReportText(active.caseInfo, active.result, active.opinionEdits),
      );
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 1500);
    } catch {
      // 클립보드 권한 없는 브라우저 — 조용히 무시
    }
  }

  // [임시·테스트용] GPT 결과 원본(JSON) 내보내기 — 토큰 안 쓰고 화면 비교 테스트하려고
  function handleExportJson() {
    if (!active?.result) return;
    const payload = {
      tool: "assessment",
      exportedAt: new Date().toISOString(),
      caseInfo: {
        plateNo: active.plateNo,
        manufacturer: active.manufacturer,
        model: active.model,
        memo: active.memo,
      },
      result: active.result,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${caseTitle(active, 0).replace(/\s+/g, "_")}_gpt_result.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // [임시·테스트용] 내보낸 JSON 업로드 → API 호출 없이 바로 화면에 출력
  async function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeId) return;
    try {
      const parsed = JSON.parse(await file.text());
      const r = (parsed?.result ?? parsed) as AssessmentResult;
      if (!r || !Array.isArray(r.parts) || !r.physical_consistency) {
        throw new Error("선견적 결과 JSON 형식이 아닙니다.");
      }
      const info = parsed?.caseInfo;
      if (info && typeof info === "object") {
        updateActive({
          plateNo: active?.plateNo || info.plateNo || "",
          manufacturer: active?.manufacturer || info.manufacturer || "",
          model: active?.model || info.model || "",
        });
      }
      setError(null);
      storeResult(activeId, r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "JSON을 읽지 못했습니다.");
    }
  }

  const fileInputClass =
    "w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/40 px-3 py-1.5 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 file:shadow-sm file:transition-colors hover:border-blue-400 hover:file:bg-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
  const textInputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-150 outline-none focus:border-blue-500 focus:shadow-[inset_0_1px_3px_rgba(37,99,235,0.12)] focus:ring-2 focus:ring-blue-500/20";

  return (
    <main className="mx-auto flex max-w-[1880px] flex-col overflow-x-clip px-6 py-8 lg:py-10 xl:h-[calc(100dvh-57px)] xl:py-4">
      {/* 제목 + 탭 바 + 입력 바 — 엑셀 틀 고정처럼 페이지가 스크롤돼도 상단에 붙어 있음 */}
      <div className="sticky top-0 z-30 -mx-6 shrink-0 bg-[var(--background)] px-6 pt-1 xl:pt-0">
        <div className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-end gap-4">
            <h1 className="shrink-0 text-2xl font-bold text-slate-900 lg:text-3xl">
              AI 선견적진단
            </h1>
            <div className="flex min-w-0 items-end gap-1 overflow-x-auto">
              {cases.map((c, i) => {
                const isActive = c.id === activeId;
                return (
                  <div
                    key={c.id}
                    className={`group flex shrink-0 items-center gap-1.5 rounded-t-xl border border-b-0 px-3.5 py-2 text-xs font-bold transition-colors ${
                      isActive
                        ? "border-blue-300 bg-white text-blue-700 shadow-[0_-4px_12px_-8px_rgba(37,99,235,0.4)]"
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
                className="shrink-0 rounded-t-xl border border-b-0 border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:border-blue-400 hover:text-blue-700"
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
              <div className="flex min-w-0 max-w-full items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 sm:text-sm">
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
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
                href={`/assess/report?case=${encodeURIComponent(active.id)}`}
                target="_blank"
                rel="noopener"
                title="인쇄용 보고서를 새 탭에서 열고 브라우저 인쇄에서 PDF로 저장"
                className="shrink-0 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 active:scale-95"
              >
                🖨 보고서 · PDF
              </a>
            )}
            {result && (
              <button
                type="button"
                onClick={handleExportJson}
                title="[임시] GPT 결과 원본 JSON 내보내기"
                className="shrink-0 rounded-full border border-dashed border-slate-400 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-95"
              >
                ⬇ 원본 JSON
              </button>
            )}
            <label
              title="[임시] 내보낸 JSON 업로드 — API 호출 없이 화면만 확인"
              className="shrink-0 cursor-pointer rounded-full border border-dashed border-slate-400 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-95"
            >
              ⬆ JSON 업로드
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleImportJson}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* 상단 가로 입력 바 — 처음 한 번만 쓰는 필드라 세로 컬럼 대신 가로로 */}
        <form
          onSubmit={handleSubmit}
          className={`mb-4 grid shrink-0 grid-cols-1 gap-3 rounded-2xl rounded-tl-none border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)] md:grid-cols-2 xl:grid-cols-[1.1fr_1.1fr_120px_110px_110px_1.4fr_auto] xl:items-start ${formOpen ? "" : "hidden xl:grid"}`}
        >
          <div>
            <label className="mb-1 block truncate text-xs font-semibold text-slate-600">
              선견적 (선택, PDF)
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
              연식
            </label>
            <input
              value={active?.year ?? ""}
              onChange={(e) => updateActive({ year: e.target.value })}
              className={textInputClass}
              placeholder="2021"
              inputMode="numeric"
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
              className="h-[38px] w-full rounded-full bg-blue-600 px-6 text-sm font-bold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_6px_16px_-4px_rgba(37,99,235,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_22px_-6px_rgba(37,99,235,0.55)] active:translate-y-0 active:scale-95 active:shadow-[0_2px_6px_rgba(37,99,235,0.4)_inset] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  처리 중
                </span>
              ) : (
                "AI 진단 시작"
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

      <div className="grid grid-cols-1 gap-6 xl:min-h-0 xl:flex-1 xl:items-stretch">
        {/* [실험] 사진 + 견적서 표를 전체 폭으로. 결과는 표 옆 열로 붙으니 별도 우측 패널 없음
            (견적서 표를 못 읽은 건만 아래에 트리로 출력) */}
        <div className="flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
          {(imagePreviews.length > 0 || estimatePreviewUrl) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]">
              {imagePreviews.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPhotosOpen((v) => !v)}
                    className="absolute right-0 top-0 z-10 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    {photosOpen
                      ? "사진 접기 ▲"
                      : `사진 펼치기 ▾ (${imagePreviews.length}장)`}
                  </button>
                  {photosOpen ? (
                    <PhotoGrid
                      previews={imagePreviews}
                      label="파손 사진"
                      highlighted={highlightedPhotos}
                      accent="blue"
                      onOpen={(i) => {
                        setLightboxSet(null);
                        setLightboxIndex(i);
                      }}
                      columns={20}
                    />
                  ) : (
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      파손 사진 ({imagePreviews.length}) — 접힘
                    </p>
                  )}
                </div>
              )}

              {estimatePreviewUrl && (
                <div
                  className={
                    imagePreviews.length > 0
                      ? "mt-4 border-t border-slate-100 pt-4"
                      : ""
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEstimate((v) => !v)}
                      className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      {showEstimate ? "선견적 숨기기 ▲" : "선견적 보기 ▾"}
                    </button>
                    {isEstimateTree(active?.estimateTree) && (
                      <button
                        type="button"
                        onClick={() => setShowPdf((v) => !v)}
                        className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50"
                      >
                        {showPdf ? "트리로 보기" : "원본 PDF 보기"}
                      </button>
                    )}
                    {active?.estimateTreeStatus === "parsing" && (
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-blue-700">
                        <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                        견적서 트리 구조화 중…
                      </span>
                    )}
                  </div>
                  {showEstimate &&
                  isEstimateTree(active?.estimateTree) &&
                  !showPdf ? (
                    <div className="mt-3 rounded-xl border border-slate-200">
                      <EstimateTreeView
                        tree={active.estimateTree as EstimateTree}
                        judgments={result ? judgmentMap : null}
                        consistency={diagnostics?.consistency ?? null}
                        onHoverPhotos={setHighlightedPhotos}
                        onOpenPhoto={openEvidencePhoto}
                      />
                    </div>
                  ) : (
                    showEstimate && (
                      <iframe
                        src={`${estimatePreviewUrl}#zoom=75`}
                        title="선견적"
                        className="mt-3 h-[75vh] w-full rounded-lg border border-slate-200"
                      />
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* 종합의견(거래처 발신용) — 접힌 바 / 펼치면 전체 폭 편집기. 선견적은 회신문이 결과물이라 유지 */}
          {result && active && (
            <div className="flex flex-col gap-3">
              {!result.estimate_provided && (
                <div className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-medium text-slate-600">
                  선견적 데이터가 제공되지 않아 사진 기반 손상유형 판독만
                  제공되었습니다. 청구 타당성은 별도 확인이 필요합니다.
                </div>
              )}
              {opinionOpen ? (
                <OpinionEditor
                  opinion={result.overall_opinion}
                  disputedItems={result.disputed_items}
                  edits={active.opinionEdits}
                  onChange={(next) => updateActive({ opinionEdits: next })}
                  onCollapse={() => setOpinionOpen(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setOpinionOpen(true)}
                  className="group flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-5 py-3 text-left text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-10px_rgba(15,23,42,0.65)] active:translate-y-0 active:scale-[0.995]"
                >
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    종합 의견{" "}
                    <span className="normal-case text-slate-500">
                      · 거래처 발신용 ·{" "}
                      {splitOpinionItems(result.overall_opinion).length -
                        active.opinionEdits.excluded.length}
                      /{splitOpinionItems(result.overall_opinion).length}건 회신
                    </span>
                  </span>
                  <span className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white transition-colors group-hover:bg-white/25">
                    펼쳐서 편집 ▴
                  </span>
                </button>
              )}
            </div>
          )}

          {!result && imagePreviews.length === 0 && !estimatePreviewUrl && (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]">
              <span aria-hidden="true" className="text-4xl opacity-50">
                📋
              </span>
              <p className="text-sm text-slate-400">
                위에서 파손 사진(과 선견적)을 첨부하고 진단을 시작하면
                <br />이 자리에 사진과 선견적 미리보기가 표시됩니다.
              </p>
            </div>
          )}
        </div>

        {/* 우: 판넬 목록 → 하위 작업 판정(각각 독립 스크롤), 980px. 종합의견은 항목별 판정이 곧 결과라 없음 */}
        {result && diagnostics && active && !inlineJudged && (
          <div className="flex flex-col gap-4 xl:min-h-0">
            <div className="min-h-0 flex-1">
              <DiagnosticsTree
                diagnostics={diagnostics}
                onHoverPhotos={setHighlightedPhotos}
                onOpenPhoto={openEvidencePhoto}
              />
            </div>
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          urls={
            lightboxSet
              ? lightboxSet.photos.map((n) => imagePreviews[n - 1].url)
              : imagePreviews.map((p) => p.url)
          }
          labels={
            lightboxSet
              ? lightboxSet.photos.map((n) => `사진 ${n}`)
              : imagePreviews.map((_, i) => `사진 ${i + 1}`)
          }
          title={lightboxSet?.title}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => {
            setLightboxIndex(null);
            setLightboxSet(null);
          }}
        />
      )}
    </main>
  );
}
