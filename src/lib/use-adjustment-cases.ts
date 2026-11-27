"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EstimateTree } from "./estimate-tree";
import { uploadPhotos } from "./upload-photos";
import {
  JobFailedError,
  postToolForm,
  runAiJob,
  type RunMeta,
} from "./ai-job-client";
import type { AdjustmentResult, VerdictOverride } from "./adjustment-types";
import { setOverride } from "./adjustment-overrides";
import {
  deleteCase,
  emptyCase,
  loadCases,
  loadFiles,
  saveCase,
  saveFiles,
  type StoredCase,
} from "./adjustment-lab-store";

// 손해사정 v2 화면의 건 관리 — 기존 화면(/adjustment/new)과 같은 캐시(IndexedDB)·같은 API를 쓴다.
// 기존 화면과 다른 점: 실행 상태를 건마다 따로 가져서 여러 건을 동시에 돌릴 수 있다.
// (기존 화면의 로직을 옮겨 온 것. 기존 화면은 건드리지 않으려고 공유하지 않고 따로 둠)

const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

export function useAdjustmentCases() {
  const [cases, setCases] = useState<StoredCase[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const active = cases.find((c) => c.id === activeId) ?? null;

  // 활성 건의 파일(state가 원본 — 캐시 복원 시 input엔 못 넣으니까)
  const [photos, setPhotos] = useState<File[]>([]);
  const [estimateFile, setEstimateFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  // 건별 실행 상태: 진행 문구(있으면 실행 중)와 오류
  const [running, setRunning] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setStep = useCallback((caseId: string, text: string | null) => {
    setRunning((prev) => {
      const next = { ...prev };
      if (text === null) delete next[caseId];
      else next[caseId] = text;
      return next;
    });
  }, []);
  const setError = useCallback((caseId: string, text: string | null) => {
    setErrors((prev) => {
      const next = { ...prev };
      if (text === null) delete next[caseId];
      else next[caseId] = text;
      return next;
    });
  }, []);

  const patchCase = useCallback((id: string, patch: Partial<StoredCase>) => {
    setCases((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      const updated = next.find((c) => c.id === id);
      if (updated) void saveCase(updated);
      return next;
    });
  }, []);
  const updateActive = useCallback(
    (patch: Partial<StoredCase>) => {
      if (activeId) patchCase(activeId, patch);
    },
    [activeId, patchCase],
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

  // 활성 건이 바뀌면 그 건의 파일 복원
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      const f = await loadFiles(activeId);
      if (cancelled) return;
      setPhotos(f.photos);
      setEstimateFile(f.estimate);
      setFileInputKey((k) => k + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const storeResult = useCallback(
    (caseId: string, r: AdjustmentResult, meta?: RunMeta | null) => {
      setCases((prev) => {
        const next = prev.map((c) =>
          c.id === caseId
            ? {
                ...c,
                result: r,
                overrides: {},
                runMeta: meta ?? null,
                jobId: null,
                jobImageUrls: [],
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
    },
    [],
  );

  // 로드 시 진행 중이던 작업 이어받기(건마다 따로)
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
        setStep(caseId, "AI 손해사정 중(이어받기)…");
        runAiJob<AdjustmentResult>(
          { jobId: c.jobId },
          c.jobImageUrls ?? [],
          (t) => setStep(caseId, t),
          undefined,
          "AI 손해사정 중(이어받기)",
          (r, meta) => storeResult(caseId, r, meta),
        )
          .catch((err) => {
            if (
              err instanceof JobFailedError &&
              err.code === "already_collected"
            ) {
              void loadCases().then(setCases);
              return;
            }
            setError(
              caseId,
              err instanceof Error
                ? err.message
                : "알 수 없는 오류가 발생했습니다.",
            );
            // 확정 실패만 이어받기 정보를 지움. 일시 오류면 남겨 둬서 새로고침으로 다시 이어받게
            if (err instanceof JobFailedError)
              patchCase(caseId, { jobId: null, jobImageUrls: [] });
          })
          .finally(() => setStep(caseId, null));
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

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

  function applyPhotos(next: File[]) {
    setPhotos(next);
    updateActive({ photoCount: next.length });
    if (activeId)
      void saveFiles(activeId, { estimate: estimateFile, photos: next });
  }

  // 사진은 고를 때마다 덧붙임(같은 파일은 한 번만)
  function addPhotos(picked: File[]) {
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
  function removePhoto(index: number) {
    applyPhotos(photos.filter((_, i) => i !== index));
  }

  async function setEstimate(file: File) {
    const caseId = activeId;
    if (!caseId) return;
    setEstimateFile(file);
    patchCase(caseId, {
      estimateName: file.name,
      estimateTree: null,
      estimateTreeStatus: "parsing",
    });
    void saveFiles(caseId, { estimate: file, photos });
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
      patchCase(caseId, {
        estimateTree: data.tree as EstimateTree,
        estimateTreeStatus: "idle",
      });
    } catch (err) {
      patchCase(caseId, { estimateTreeStatus: "error" });
      setError(
        caseId,
        err instanceof Error ? err.message : "견적서 구조화에 실패했습니다.",
      );
    }
  }

  // 활성 건 실행. 실행 상태는 건마다 따로라서 끝나기 전에 다른 건을 또 시작할 수 있다.
  async function submit() {
    if (!active || !activeId) return;
    const caseId = activeId;
    if (running[caseId]) return;
    if (!estimateFile) {
      setError(caseId, "청구 견적서(PDF)를 첨부해주세요.");
      return;
    }
    if (photos.length === 0) {
      setError(caseId, "수리작업 사진을 1장 이상 첨부해주세요.");
      return;
    }
    const filesAtStart = { estimate: estimateFile, photos };
    const info = {
      manufacturer: active.manufacturer,
      model: active.model,
      memo: active.memo,
      plateNo: active.plateNo ?? "",
    };
    setError(caseId, null);
    setStep(caseId, "사진 업로드 준비 중…");
    patchCase(caseId, { result: null, caseInfo: null });
    try {
      const { urls: imageUrls, compressed } = await uploadPhotos(
        filesAtStart.photos,
        (t) => setStep(caseId, t),
      );
      void saveFiles(caseId, {
        estimate: filesAtStart.estimate,
        photos: compressed,
      });
      const formData = new FormData();
      formData.append("estimate", filesAtStart.estimate);
      formData.append("manufacturer", info.manufacturer);
      formData.append("model", info.model);
      formData.append("memo", info.memo);
      formData.append("plateNo", info.plateNo);
      formData.append("imageUrls", JSON.stringify(imageUrls));
      setStep(caseId, "AI 손해사정 중… (사진이 많으면 수 분 소요)");
      const data = await postToolForm<AdjustmentResult>(
        "/api/adjustment-lab",
        formData,
        "청구 견적서(PDF)",
      );
      await runAiJob<AdjustmentResult>(
        data,
        imageUrls,
        (t) => setStep(caseId, t),
        (jobId) => patchCase(caseId, { jobId, jobImageUrls: imageUrls }),
        "AI 손해사정 중",
        (r, meta) => storeResult(caseId, r, meta),
      );
    } catch (err) {
      setError(
        caseId,
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setStep(caseId, null);
    }
  }

  function override(
    lineNo: string | number,
    verdict: VerdictOverride["verdict"] | null,
  ) {
    if (!active?.result) return;
    updateActive({
      overrides: setOverride(active.result, active.overrides, lineNo, verdict),
    });
  }

  // [임시·테스트용] 내보낸 원본 JSON을 읽어 API 호출 없이 화면에 올림
  async function importJson(file: File) {
    if (!activeId) return;
    const caseId = activeId;
    try {
      const parsed = JSON.parse(await file.text());
      const r = (parsed?.result ?? parsed) as AdjustmentResult;
      if (!r || !Array.isArray(r.items) || !r.physical_consistency)
        throw new Error("손해사정 결과 JSON 형식이 아닙니다.");
      const info = parsed?.caseInfo;
      if (info && typeof info === "object")
        patchCase(caseId, {
          plateNo: active?.plateNo || info.plateNo || "",
          manufacturer: active?.manufacturer || info.manufacturer || "",
          model: active?.model || info.model || "",
        });
      setError(caseId, null);
      storeResult(caseId, r);
    } catch (err) {
      setError(
        caseId,
        err instanceof Error ? err.message : "JSON을 읽지 못했습니다.",
      );
    }
  }

  return {
    cases,
    active,
    activeId,
    setActiveId,
    hydrated,
    photos,
    estimateFile,
    fileInputKey,
    running,
    errors,
    clearError: (id: string) => setError(id, null),
    updateActive,
    addCase,
    removeCase,
    addPhotos,
    removePhoto,
    setEstimate,
    submit,
    override,
    importJson,
  };
}
