"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ImageLightbox } from "@/components/ImageLightbox";
import { DiagnosticsTree } from "@/components/DiagnosticsTree";
import { V2AmountDetail, V2AmountStrip } from "@/components/v2/V2Amounts";
import { V2Sidebar } from "@/components/v2/V2Sidebar";
import { V2Table } from "@/components/v2/V2Table";
import { BTN, BTN_ACCENT, BTN_DARK, INPUT, cx } from "@/components/v2/ui";
import { useAdjustmentCases } from "@/lib/use-adjustment-cases";
import { isEstimateTree, type EstimateTree } from "@/lib/estimate-tree";
import {
  buildAdjustmentDiagnostics,
  type ItemDiagnostic,
} from "@/lib/adjustment-review-items";
import { applyOverrides, overrideKey } from "@/lib/adjustment-overrides";
import {
  RATE_ALL,
  computeAmounts,
  estimateRatesByKind,
  type LaborRates,
} from "@/lib/adjustment-amounts";
import { buildAmountReport } from "@/lib/adjustment-amount-report";
import { buildAnalysisExport } from "@/lib/adjustment-analysis-export";
import { buildAdjustmentReportText } from "@/lib/format-adjustment-report";
import { caseTitle } from "@/lib/adjustment-lab-store";

// 손해사정 v2 — 새 디자인(밝은 콘솔). 기존 화면(/adjustment/new)과 같은 건 캐시·같은 API를 쓰므로
// 한쪽에서 돌린 건이 다른 쪽에도 그대로 보인다. 기존 화면은 그대로 둠.

function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 1)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AdjustmentV2Page() {
  const h = useAdjustmentCases();
  const { active, activeId, cases, photos, estimateFile } = h;

  const [selected, setSelected] = useState<string | null>(null);
  const [hoverRefs, setHoverRefs] = useState<number[]>([]);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [amountOpen, setAmountOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState<{
    index: number;
    set: number[] | null;
    title?: string;
  } | null>(null);
  // 건이 바뀌면 선택·강조를 비움(렌더 중 비교 — effect에서 setState 하지 않음)
  const [syncedId, setSyncedId] = useState<string | null>(null);
  if (syncedId !== activeId) {
    setSyncedId(activeId);
    setSelected(null);
    setHoverRefs([]);
    setLightbox(null);
  }

  const photoUrls = useMemo(
    () => photos.map((f) => URL.createObjectURL(f)),
    [photos],
  );
  useEffect(
    () => () => photoUrls.forEach((u) => URL.revokeObjectURL(u)),
    [photoUrls],
  );
  const pdfUrl = useMemo(
    () => (estimateFile ? URL.createObjectURL(estimateFile) : null),
    [estimateFile],
  );
  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    },
    [pdfUrl],
  );

  const tree = isEstimateTree(active?.estimateTree)
    ? (active!.estimateTree as EstimateTree)
    : null;
  const result = active?.result
    ? applyOverrides(active.result, active.overrides)
    : null;
  const rates: LaborRates =
    active?.laborRates ??
    (active?.laborRate ? { [RATE_ALL]: active.laborRate } : {});
  const amounts = result && tree ? computeAmounts(tree, result, rates) : null;
  const report = amounts ? buildAmountReport(tree, result, amounts) : null;
  const diagnostics = result ? buildAdjustmentDiagnostics(result) : null;
  const judgmentMap = diagnostics
    ? new Map<string, ItemDiagnostic>(
        diagnostics.branches
          .flatMap((b) => [b.main, ...b.children])
          .filter((d): d is ItemDiagnostic => !!d && d.lineNo != null)
          .map((d) => [overrideKey(d.lineNo), d] as const),
      )
    : null;
  const evidence = new Set<number>();
  if (judgmentMap)
    for (const d of judgmentMap.values())
      d.view.photoRefs.forEach((n) => evidence.add(n));
  const selectedRefs =
    selected && judgmentMap
      ? (judgmentMap.get(selected)?.view.photoRefs ?? [])
      : [];
  const highlighted = hoverRefs.length ? hoverRefs : selectedRefs;
  const overrideCount = Object.values(active?.overrides ?? {}).filter(
    (o) => !o.cascaded,
  ).length;

  const runStep = activeId ? h.running[activeId] : undefined;
  const isRunning = !!runStep;
  const error = activeId ? h.errors[activeId] : undefined;
  const resultCases = cases.filter((c) => c.result);
  const showForm = formOpen || (!result && !isRunning);

  function openPhoto(n: number, set: number[] | null, title?: string) {
    if (n < 1 || n > photoUrls.length) return;
    const valid = (set ?? []).filter((x) => x >= 1 && x <= photoUrls.length);
    if (valid.length > 1 && valid.includes(n))
      setLightbox({ index: valid.indexOf(n), set: valid, title });
    else setLightbox({ index: n - 1, set: null });
  }

  function setRates(next: LaborRates) {
    h.updateActive({ laborRates: next, laborRate: next[RATE_ALL] ?? null });
  }

  async function copyReport() {
    if (!result || !active?.caseInfo) return;
    try {
      await navigator.clipboard.writeText(
        buildAdjustmentReportText(active.caseInfo, result, amounts, report),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한 없는 브라우저 — 조용히 무시
    }
  }

  function exportAnalysis(scope: "one" | "all") {
    const targets = scope === "all" ? resultCases : active ? [active] : [];
    if (!targets.length) return;
    const payload = buildAnalysisExport(targets, cases);
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    download(
      scope === "all"
        ? `손해사정_분석_${ymd}_${payload.cases.length}건.json`
        : `손해사정_분석_${caseTitle(active!, 0).replace(/\s+/g, "_")}.json`,
      payload,
    );
  }

  function exportRaw() {
    if (!active?.result) return;
    download(`${caseTitle(active, 0).replace(/\s+/g, "_")}_gpt_result.json`, {
      tool: "adjustment-lab",
      exportedAt: new Date().toISOString(),
      caseInfo: {
        plateNo: active.plateNo,
        manufacturer: active.manufacturer,
        model: active.model,
        memo: active.memo,
      },
      result: active.result,
    });
  }

  const chipBox =
    "rounded-md bg-[#F3F5F7] px-2.5 py-[5px] shadow-[inset_0_1px_2px_rgba(17,24,39,0.12)]";

  return (
    <>
      {/* 머리: 건 탭 + 실행 결과에 대한 동작 */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-[#D9DEE5] bg-white px-5 py-3">
        <h1 className="text-[17px] font-black tracking-tight">
          AI 손해사정{" "}
          <span className="num rounded-md bg-[#E7F4EE] px-1.5 py-0.5 align-middle text-[11px] font-bold text-[#00593B]">
            v2
          </span>
        </h1>
        <div role="tablist" aria-label="건" className="flex flex-wrap gap-1.5">
          {cases.map((c, i) => {
            const on = c.id === activeId;
            const busy = !!h.running[c.id];
            return (
              <span key={c.id} className="relative flex">
                <button
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => h.setActiveId(c.id)}
                  className={cx(
                    "flex h-[34px] items-center gap-1.5 rounded-lg border pl-3 pr-7 text-[13px] transition-all duration-150 active:scale-[0.97]",
                    on
                      ? "border-gray-900 bg-gray-900 font-bold text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
                      : "border-[#D9DEE5] bg-white font-medium text-gray-700 hover:-translate-y-px hover:bg-gray-50",
                  )}
                >
                  {busy && (
                    <span
                      aria-label="진행 중"
                      className={cx(
                        "h-2.5 w-2.5 animate-spin rounded-full border-2",
                        on
                          ? "border-white/40 border-t-white"
                          : "border-[#8CC7AD] border-t-[#00704A]",
                      )}
                    />
                  )}
                  {caseTitle(c, i)}
                  {!busy && c.result && (
                    <span
                      aria-label="결과 있음"
                      className={cx(
                        "h-1.5 w-1.5 rounded-full",
                        on ? "bg-[#7DDFA6]" : "bg-[#00704A]",
                      )}
                    />
                  )}
                </button>
                <button
                  type="button"
                  aria-label={`${caseTitle(c, i)} 닫기`}
                  title="이 건 지우기(브라우저 캐시에서 삭제)"
                  onClick={() => {
                    if (
                      window.confirm(
                        "이 건을 지울까요? 결과·사진 캐시가 삭제됩니다.",
                      )
                    )
                      h.removeCase(c.id);
                  }}
                  className={cx(
                    "absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-sm leading-none transition-colors",
                    on
                      ? "text-white/70 hover:bg-white/20 hover:text-white"
                      : "text-gray-500 hover:bg-gray-200 hover:text-gray-900",
                  )}
                >
                  ×
                </button>
              </span>
            );
          })}
          <button
            type="button"
            aria-label="새 건"
            title="새 건"
            onClick={h.addCase}
            className="h-[34px] w-[34px] rounded-lg border border-dashed border-gray-400 bg-white text-base text-gray-600 transition-all hover:-translate-y-px hover:bg-gray-50 active:scale-95"
          >
            +
          </button>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {result && (
            <button
              type="button"
              onClick={copyReport}
              className={cx(copied ? BTN_ACCENT : BTN, "h-[34px]")}
            >
              {copied ? "복사됨" : "결과 전체 복사"}
            </button>
          )}
          {result && active && (
            <a
              href={`/adjustment/report?case=${encodeURIComponent(active.id)}`}
              target="_blank"
              rel="noopener"
              className={cx(BTN, "h-[34px]")}
            >
              보고서 PDF
            </a>
          )}
          {result && (
            <button
              type="button"
              onClick={() => exportAnalysis("one")}
              className={cx(
                BTN,
                "h-[34px] border-[#00704A] text-[#00704A] hover:bg-[#E7F4EE]",
              )}
            >
              분석 내보내기
            </button>
          )}
          {resultCases.length > 1 && (
            <button
              type="button"
              onClick={() => exportAnalysis("all")}
              className={cx(BTN_ACCENT, "h-[34px]")}
            >
              전체 {resultCases.length}건 분석 내보내기
            </button>
          )}
          {result && (
            <button
              type="button"
              onClick={exportRaw}
              title="[임시] GPT 결과 원본 JSON 내보내기"
              className="h-[34px] rounded-lg border border-dashed border-gray-400 bg-white px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              원본 JSON
            </button>
          )}
          <label
            title="[임시] 내보낸 JSON 업로드 — API 호출 없이 화면만 확인"
            className="flex h-[34px] cursor-pointer items-center rounded-lg border border-dashed border-gray-400 bg-white px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            JSON 업로드
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void h.importJson(f);
              }}
            />
          </label>
          <Link
            href="/adjustment/new"
            title="기존 손해사정 화면(같은 건이 그대로 보임)"
            className="flex h-[34px] items-center rounded-lg px-2 text-xs font-medium text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline"
          >
            기존 화면
          </Link>
        </div>
      </header>

      {/* 입력: 결과가 있으면 한 줄 요약, 펼치면 입력 칸 */}
      {active && (
        <section
          aria-label="입력"
          className="flex flex-col gap-2 border-b border-[#D9DEE5] bg-white px-5 py-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <span className="font-bold text-gray-600">입력</span>
            <span className={chipBox}>
              <span className="text-gray-600">청구 견적서</span>{" "}
              <strong>{active.estimateName ?? "없음"}</strong>
            </span>
            <span className={chipBox}>
              <span className="text-gray-600">사진</span>{" "}
              <strong className="num">{photos.length}장</strong>
            </span>
            <span className={chipBox}>
              <span className="text-gray-600">차량번호</span>{" "}
              <strong>{active.plateNo || "-"}</strong>
            </span>
            <span className={chipBox}>
              <span className="text-gray-600">제조사·차종</span>{" "}
              <strong>
                {`${active.manufacturer} ${active.model}`.trim() || "-"}
              </strong>
            </span>
            {active.memo && (
              <span className={cx(chipBox, "min-w-0 flex-1 basis-48 truncate")}>
                <span className="text-gray-600">담당자 메모</span>{" "}
                <strong>{active.memo}</strong>
              </span>
            )}
            {(result || isRunning) && (
              <button
                type="button"
                onClick={() => setFormOpen((v) => !v)}
                aria-expanded={showForm}
                className={cx(BTN, "h-[30px] px-2.5")}
              >
                {showForm ? "입력 접기" : "입력 펼치기"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void h.submit()}
              disabled={isRunning || !h.hydrated}
              className={cx(result ? BTN_DARK : BTN_ACCENT, "h-[30px]")}
            >
              {isRunning ? "진행 중…" : result ? "다시 실행" : "손해사정 시작"}
            </button>
          </div>
          {showForm && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5 pb-2 pt-1 motion-safe:animate-[fadeInUp_.2s_ease-out]">
              <label className="flex flex-col gap-1 font-bold text-gray-600">
                청구 견적서 (필수, PDF)
                <input
                  key={`e${h.fileInputKey}`}
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={isRunning}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void h.setEstimate(f);
                  }}
                  className="h-9 w-full rounded-lg border border-dashed border-gray-400 bg-[#F3F5F7] px-2 py-1.5 text-xs font-medium text-gray-900 file:mr-2 file:rounded file:border-0 file:bg-white file:px-2 file:py-0.5 file:text-xs file:font-bold file:shadow-sm"
                />
              </label>
              <label className="flex flex-col gap-1 font-bold text-gray-600">
                수리작업 사진 (여러 장, 고를 때마다 덧붙음)
                <input
                  key={`p${h.fileInputKey}`}
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={isRunning}
                  onChange={(e) => {
                    const picked = e.target.files
                      ? Array.from(e.target.files)
                      : [];
                    e.target.value = "";
                    h.addPhotos(picked);
                  }}
                  className="h-9 w-full rounded-lg border border-dashed border-gray-400 bg-[#F3F5F7] px-2 py-1.5 text-xs font-medium text-gray-900 file:mr-2 file:rounded file:border-0 file:bg-white file:px-2 file:py-0.5 file:text-xs file:font-bold file:shadow-sm"
                />
              </label>
              <label className="flex flex-col gap-1 font-bold text-gray-600">
                차량번호
                <input
                  type="text"
                  value={active.plateNo ?? ""}
                  onChange={(e) => h.updateActive({ plateNo: e.target.value })}
                  placeholder="12가 3456"
                  className={INPUT}
                />
              </label>
              <label className="flex flex-col gap-1 font-bold text-gray-600">
                제조사
                <input
                  type="text"
                  value={active.manufacturer}
                  onChange={(e) =>
                    h.updateActive({ manufacturer: e.target.value })
                  }
                  placeholder="현대"
                  className={INPUT}
                />
              </label>
              <label className="flex flex-col gap-1 font-bold text-gray-600">
                차종
                <input
                  type="text"
                  value={active.model}
                  onChange={(e) => h.updateActive({ model: e.target.value })}
                  placeholder="싼타페"
                  className={INPUT}
                />
              </label>
              <label className="flex flex-col gap-1 font-bold text-gray-600">
                담당자 추가 의견
                <input
                  type="text"
                  value={active.memo}
                  onChange={(e) => h.updateActive({ memo: e.target.value })}
                  placeholder="특이사항·확인 요청"
                  className={INPUT}
                />
              </label>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-[#F1A9A0] bg-[#FDECEA] px-3 py-2 text-[13px] text-[#912018]"
            >
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={() => activeId && h.clearError(activeId)}
                aria-label="오류 닫기"
                className="font-bold"
              >
                ×
              </button>
            </div>
          )}
          {isRunning && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 rounded-lg border border-[#8CC7AD] bg-[#E7F4EE] px-3 py-2 text-[13px] text-[#00593B]"
            >
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#8CC7AD] border-t-[#00704A]" />
              <span className="font-bold">{runStep}</span>
              <span className="text-xs text-[#00593B]/80">
                다른 건 탭으로 옮겨 또 시작해도 됨. 새로고침해도 이어받음.
              </span>
            </div>
          )}
        </section>
      )}

      {amounts && (
        <V2AmountStrip
          amounts={amounts}
          report={report}
          overrideCount={overrideCount}
          rates={rates}
          onRatesChange={setRates}
          open={amountOpen}
          onToggle={() => setAmountOpen((v) => !v)}
        />
      )}
      {amountOpen && report && (
        <V2AmountDetail
          report={report}
          kindRates={estimateRatesByKind(tree)}
          rates={rates}
          onRatesChange={setRates}
        />
      )}

      {/* 본문: 왼쪽 패널(접힘 가능) + 견적서 표 */}
      {active && (photos.length > 0 || tree || pdfUrl || result) ? (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <V2Sidebar
            collapsed={sideCollapsed}
            onToggle={() => setSideCollapsed((v) => !v)}
            plan={result?.repair_plan ?? null}
            urls={photoUrls}
            highlighted={highlighted}
            evidence={evidence}
            selectedRefs={selectedRefs}
            onOpen={(n, set) => openPhoto(n, set)}
            // 결과가 나온 뒤엔 사진 번호가 근거 번호라서 빼지 못하게 함
            onRemove={result || isRunning ? undefined : h.removePhoto}
          />
          {tree || pdfUrl ? (
            <V2Table
              key={active.id}
              tree={tree}
              judgments={judgmentMap}
              consistency={diagnostics?.consistency ?? null}
              amounts={amounts}
              pdfUrl={pdfUrl}
              parsing={active.estimateTreeStatus === "parsing"}
              selected={selected}
              photoUrls={photoUrls}
              onSelect={setSelected}
              onHover={setHoverRefs}
              onOpenPhoto={(n, refs, name) =>
                openPhoto(n, refs, `${name} 근거 사진`)
              }
              onOverride={result ? h.override : undefined}
            />
          ) : (
            <div className="flex-1 bg-white" />
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <p className="text-lg font-black">
            {h.hydrated ? "견적서와 사진을 넣으면 시작됨" : "불러오는 중…"}
          </p>
          <p className="max-w-md text-sm leading-relaxed text-gray-600">
            위 입력 칸에서 청구 견적서(PDF)와 수리작업 사진을 첨부하고 손해사정
            시작을 누르면, 이 자리에 견적서 표와 판정이 나옴.
          </p>
        </div>
      )}

      {/* 견적서 표를 못 읽은 건은 판정을 목록으로 */}
      {result && diagnostics && !tree && (
        <div className="border-t border-[#D9DEE5] bg-white p-4">
          <p className="mb-2 text-xs text-gray-600">
            견적서 표를 읽지 못해 금액 비교 없이 판정만 표시함.
          </p>
          <DiagnosticsTree
            diagnostics={diagnostics}
            onHoverPhotos={setHoverRefs}
            onOpenPhoto={(n) => openPhoto(n, null)}
          />
        </div>
      )}

      {lightbox && (
        <ImageLightbox
          urls={
            lightbox.set ? lightbox.set.map((n) => photoUrls[n - 1]) : photoUrls
          }
          labels={
            lightbox.set
              ? lightbox.set.map((n) => `사진 ${n}`)
              : photoUrls.map((_, i) => `사진 ${i + 1}`)
          }
          title={lightbox.title}
          index={lightbox.index}
          onIndexChange={(i) =>
            setLightbox((cur) => cur && { ...cur, index: i })
          }
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
