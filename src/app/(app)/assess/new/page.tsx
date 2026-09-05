"use client";

import { useState } from "react";
import { AssessmentResultView } from "@/components/AssessmentResultView";
import { compressImage } from "@/lib/image-compress";
import type { AssessmentResult } from "@/lib/assessment-types";
import type { ReportCaseInfo } from "@/lib/format-report";

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

  async function handleEstimateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

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

  const fileInputClass =
    "w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm transition-all duration-150 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 file:transition-colors hover:border-blue-400 hover:file:bg-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
  const textInputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-all duration-150 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">신규 진단</h1>
        <p className="mt-1 text-sm text-slate-500">
          선견적과 파손 사진을 먼저 첨부하면 차량정보를 자동으로 채워줍니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
            className={fileInputClass}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
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
        <div>
          <h2 className="mb-3 text-lg font-bold text-slate-900">진단 결과</h2>
          <AssessmentResultView caseInfo={caseInfo} result={result} />
        </div>
      )}
    </main>
  );
}
