"use client";

import { useState } from "react";
import { ProcedureResultView } from "@/components/ProcedureResultView";
import { compressImage } from "@/lib/image-compress";
import type { ProcedureResult } from "@/lib/procedure-types";
import type { ProcedureCaseInfo } from "@/lib/format-procedure-report";

export default function NewProcedurePage() {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcedureResult | null>(null);
  const [caseInfo, setCaseInfo] = useState<ProcedureCaseInfo | null>(null);

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

  const fileInputClass =
    "w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm transition-all duration-150 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 file:transition-colors hover:border-blue-400 hover:file:bg-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
  const textInputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-all duration-150 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">정비공정 판단</h1>
        <p className="mt-1 text-sm text-slate-500">
          선견적 없이 파손 사진만으로 어떤 작업이 필요한지 AI가 먼저 판단합니다.
          (선견적 접수 후에는 [선견적진단]으로 다시 검증하세요.)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            파손 사진 (필수, 여러 장 가능)
          </label>
          <input name="images" type="file" accept="image/*" multiple required className={fileInputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
        <div>
          <h2 className="mb-3 text-lg font-bold text-slate-900">판단 결과</h2>
          <ProcedureResultView caseInfo={caseInfo} result={result} />
        </div>
      )}
    </main>
  );
}
