"use client";

import { useState } from "react";
import type { OpinionEditState } from "@/lib/format-report";
import { buildEditedOpinion, splitOpinionItems } from "@/lib/format-report";

// 선견적 종합의견 — 공업사 회신용이라 담당자가 항목 단위로 손봐야 함.
// 담당자가 봤을 때 정상인 항목은 "제외"(복사·전체보고서에서 빠짐), 문구는 항목별 "편집".
export function OpinionEditor({
  opinion,
  disputedItems,
  edits,
  onChange,
  onCollapse,
}: {
  opinion: string;
  disputedItems: string[];
  edits: OpinionEditState;
  onChange: (next: OpinionEditState) => void;
  onCollapse?: () => void;
}) {
  const items = splitOpinionItems(opinion);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const keptCount =
    items.length - edits.excluded.filter((i) => i < items.length).length;

  function toggleExclude(i: number) {
    const excluded = edits.excluded.includes(i)
      ? edits.excluded.filter((x) => x !== i)
      : [...edits.excluded, i];
    onChange({ ...edits, excluded });
    if (editingIdx === i) setEditingIdx(null);
  }

  function setText(i: number, t: string) {
    onChange({ ...edits, text: { ...edits.text, [i]: t } });
  }

  function resetText(i: number) {
    const text = { ...edits.text };
    delete text[i];
    onChange({ ...edits, text });
  }

  async function copy() {
    const body = buildEditedOpinion(opinion, edits);
    const tail = disputedItems.length
      ? `\n\n협의 필요 항목: ${disputedItems.join(", ")}`
      : "";
    try {
      await navigator.clipboard.writeText(body + tail);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한 없는 브라우저 — 조용히 무시
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-slate-900 px-5 py-3.5 text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)] xl:h-full">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
          종합 의견{" "}
          <span className="normal-case text-slate-500">
            · 거래처 발신용 · {keptCount}/{items.length}건 회신
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={copy}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all active:scale-95 ${
              copied ? "bg-emerald-600" : "bg-white/15 hover:bg-white/25"
            }`}
          >
            {copied ? "복사됨 ✓" : "회신문 복사"}
          </button>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-white/25 active:scale-95"
            >
              검토 항목으로 ▾
            </button>
          )}
        </div>
      </div>

      <ol className="mt-2 flex min-h-0 flex-col gap-1.5 overflow-y-auto pr-1">
        {items.map((orig, i) => {
          const excluded = edits.excluded.includes(i);
          const text = edits.text[i] ?? orig;
          const edited = edits.text[i] !== undefined && edits.text[i] !== orig;
          const isEditing = editingIdx === i;
          return (
            <li
              key={i}
              className={`group flex items-start gap-2 rounded-xl px-3 py-2 transition-colors ${
                excluded
                  ? "bg-white/[0.03]"
                  : "bg-white/[0.07] hover:bg-white/10"
              }`}
            >
              <span
                className={`mt-0.5 w-5 shrink-0 text-right font-mono text-[11px] font-bold ${excluded ? "text-slate-600" : "text-slate-400"}`}
              >
                {items.length > 1 ? i + 1 : "•"}
              </span>
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <textarea
                    autoFocus
                    value={text}
                    onChange={(e) => setText(i, e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-sm font-medium leading-relaxed text-white outline-none focus:border-white/40"
                  />
                ) : (
                  <p
                    className={`whitespace-pre-line text-sm font-medium leading-relaxed ${
                      excluded
                        ? "text-slate-500 line-through decoration-slate-600"
                        : "text-slate-100"
                    }`}
                  >
                    {text}
                  </p>
                )}
                {(excluded || edited) && !isEditing && (
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                    {excluded ? "제외됨 — 회신에서 빠짐" : "수정됨"}
                  </p>
                )}
              </div>
              <span className="flex shrink-0 items-center gap-1 pt-0.5">
                {!excluded && (
                  <button
                    type="button"
                    onClick={() => setEditingIdx(isEditing ? null : i)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all active:scale-95 ${
                      isEditing
                        ? "bg-emerald-600 text-white"
                        : "bg-white/10 text-slate-200 hover:bg-white/20"
                    }`}
                  >
                    {isEditing ? "완료" : "편집"}
                  </button>
                )}
                {edited && !isEditing && !excluded && (
                  <button
                    type="button"
                    onClick={() => resetText(i)}
                    title="AI 원문으로 되돌리기"
                    className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-300 transition-all hover:bg-white/20 active:scale-95"
                  >
                    원문
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleExclude(i)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all active:scale-95 ${
                    excluded
                      ? "bg-emerald-600/90 text-white hover:bg-emerald-500"
                      : "bg-red-500/80 text-white hover:bg-red-500"
                  }`}
                >
                  {excluded ? "복원" : "제외"}
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      {disputedItems.length > 0 && (
        <p className="mt-2 shrink-0 text-[11px] text-slate-400">
          협의 필요 항목: {disputedItems.join(", ")}
        </p>
      )}
    </div>
  );
}
