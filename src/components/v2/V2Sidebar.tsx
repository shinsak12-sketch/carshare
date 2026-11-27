"use client";

import { useEffect, useRef, useState } from "react";
import type { RepairPlan } from "@/lib/adjustment-types";
import { BTN, SEG_WRAP, confidenceTone, cx, segBtn } from "./ui";

// 왼쪽 패널: 1단계 수리 계획 + 수리작업 사진. 패널 전체를 왼쪽으로 접었다 펼 수 있다.
// 사진은 수백 장이어도 패널 안에서만 스크롤하고, 표에서 가리킨 항목의 근거 사진을 강조한다.

type PhotoTab = "all" | "evidence" | "selected";

function PlanSection({ plan }: { plan: RepairPlan }) {
  const [open, setOpen] = useState(true);
  const [pathOpen, setPathOpen] = useState(false);
  const [rejOpen, setRejOpen] = useState(false);
  const byWork = new Map<string, string[]>();
  for (const a of plan.access_path) {
    const list = byWork.get(a.for_work) ?? [];
    list.push(a.item);
    byWork.set(a.for_work, list);
  }
  return (
    <section
      aria-label="수리 계획"
      className="border-b border-[#D9DEE5] px-4 pb-3.5 pt-4"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-[5px] bg-gray-900 px-[7px] py-0.5 text-[11px] font-bold text-white">
          1단계 · 정비사
        </span>
        <span className="text-[13px] font-bold">수리 계획</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cx(BTN, "ml-auto h-7 px-2")}
        >
          {open ? "접기" : "펼치기"}
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-bold">{plan.vehicle_structure}</span>
        {typeof plan.structure_confidence === "number" && (
          <span
            title="차종 구조 판정이 맞을 확률 — 틀리면 접근·분해 경로 전체가 틀림"
            className={cx(
              "num rounded-full border px-[7px] py-px text-[11px] font-bold",
              confidenceTone(plan.structure_confidence),
            )}
          >
            구조 {plan.structure_confidence}%
          </span>
        )}
        <span className="text-xs text-gray-600">
          메인 {plan.main_works.length} · 경로 {plan.access_path.length} ·
          불필요 {plan.rejected.length}
        </span>
      </div>
      {open && (
        <div className="motion-safe:animate-[fadeInUp_.2s_ease-out]">
          <p className="mb-2.5 mt-1.5 text-[13px] leading-relaxed text-gray-700">
            {plan.damage_summary}
          </p>
          <ul className="flex flex-col border-t border-gray-900">
            {plan.main_works.map((w, i) => (
              <li
                key={i}
                title={w.reasoning}
                className="flex items-center justify-between gap-2 border-b border-gray-200 px-0.5 py-[7px] text-[13px]"
              >
                <span className="min-w-0 font-medium">
                  {w.part_name}
                  {w.judgment_basis === "추론" && (
                    <span className="ml-1.5 rounded-full border border-dashed border-[#6D28D9] px-1.5 text-[11px] font-bold text-[#6D28D9]">
                      추론
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-gray-600">{w.work}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {plan.access_path.length > 0 && (
              <button
                type="button"
                onClick={() => setPathOpen((v) => !v)}
                aria-expanded={pathOpen}
                className={cx(BTN, "h-7 px-2 font-medium")}
              >
                {pathOpen
                  ? "접근·분해 경로 닫기"
                  : `접근·분해 경로 ${plan.access_path.length} 보기`}
              </button>
            )}
            {plan.rejected.length > 0 && (
              <button
                type="button"
                onClick={() => setRejOpen((v) => !v)}
                aria-expanded={rejOpen}
                className="h-7 rounded-lg border border-[#F1A9A0] bg-[#FDECEA] px-2 text-xs font-bold text-[#912018] transition-all hover:-translate-y-px active:scale-[0.97]"
              >
                {rejOpen
                  ? "계획 밖 청구 닫기"
                  : `계획 밖 청구 ${plan.rejected.length}`}
              </button>
            )}
          </div>
          {pathOpen && (
            <ul className="mt-2 list-disc pl-4 text-xs leading-relaxed text-gray-700">
              {[...byWork.entries()].map(([work, items]) => (
                <li key={work}>
                  <span className="font-bold">{work}</span> — {items.join(", ")}
                </li>
              ))}
            </ul>
          )}
          {rejOpen && (
            <ul className="mt-2 list-disc pl-4 text-xs leading-relaxed text-[#912018]">
              {plan.rejected.map((r, i) => (
                <li key={i}>
                  {r.line_no != null && (
                    <span className="num">{r.line_no} </span>
                  )}
                  <span className="font-bold">{r.item_name}</span> —{" "}
                  {r.reasoning}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function PhotoSection({
  urls,
  highlighted,
  evidence,
  selectedRefs,
  onOpen,
  onRemove,
}: {
  urls: string[];
  highlighted: number[];
  evidence: Set<number>;
  selectedRefs: number[];
  onOpen: (photoNo: number, set: number[] | null) => void;
  onRemove?: (index: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<PhotoTab>("all");
  const boxRef = useRef<HTMLDivElement>(null);
  const hi = new Set(highlighted);
  const evidenceList = [...evidence]
    .filter((n) => n >= 1 && n <= urls.length)
    .sort((a, b) => a - b);
  const selList = selectedRefs.filter((n) => n >= 1 && n <= urls.length);
  const list =
    tab === "all"
      ? urls.map((_, i) => i + 1)
      : tab === "evidence"
        ? evidenceList
        : selList;

  // 강조된 사진이 스크롤 밖이면 패널 안에서만 그 위치로 이동(페이지는 안 움직임)
  const firstHi = highlighted.length ? Math.min(...highlighted) : null;
  useEffect(() => {
    const box = boxRef.current;
    if (!box || firstHi == null) return;
    const el = box.querySelector<HTMLElement>(`[data-photo="${firstHi}"]`);
    if (!el) return;
    const top = el.offsetTop - box.offsetTop;
    if (
      top < box.scrollTop ||
      top + el.offsetHeight > box.scrollTop + box.clientHeight
    )
      box.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
  }, [firstHi, tab]);

  return (
    <section
      aria-label="수리작업 사진"
      className="flex min-h-0 flex-1 flex-col gap-2.5 px-4 py-3.5"
    >
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold">수리작업 사진</span>
        <span className="num text-xs font-bold text-gray-600">
          {urls.length}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cx(BTN, "ml-auto h-7 px-2")}
        >
          {open ? "사진 접기" : "사진 펼치기"}
        </button>
      </div>
      {open && (
        <>
          <div role="tablist" aria-label="사진 보기" className={SEG_WRAP}>
            {(
              [
                ["all", `전체 ${urls.length}`],
                ["evidence", `판정 근거 ${evidenceList.length}`],
                ["selected", `선택 항목 ${selList.length}`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cx(segBtn(tab === k), "flex-1")}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            ref={boxRef}
            className="relative max-h-[calc(100dvh-220px)] min-h-[180px] flex-1 overflow-y-auto rounded-lg border border-[#D9DEE5] bg-white p-1.5"
          >
            {list.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs leading-relaxed text-gray-600">
                {tab === "selected"
                  ? "표에서 항목을 누르면 그 항목의 근거 사진만 여기에 모임."
                  : urls.length === 0
                    ? "아직 사진이 없음."
                    : "판정 근거로 쓰인 사진이 없음."}
              </p>
            ) : (
              <div className="grid grid-cols-5 gap-[5px]">
                {list.map((n) => {
                  const on = hi.has(n);
                  return (
                    <div key={n} data-photo={n} className="group relative">
                      <button
                        type="button"
                        onClick={() => onOpen(n, tab === "all" ? null : list)}
                        aria-label={`사진 ${n} 확대`}
                        className={cx(
                          "relative block aspect-[4/3] w-full overflow-hidden rounded-[5px] bg-[#F3F5F7] transition-all duration-150 hover:brightness-95 active:scale-95",
                          on
                            ? "outline outline-2 outline-[#00704A] ring-2 ring-[#00704A]/25"
                            : "border border-[#C5CCD6]",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={urls[n - 1]}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                        <span
                          className={cx(
                            "num absolute left-0 top-0 rounded-br-[5px] px-1 text-[10px] font-bold",
                            on
                              ? "bg-[#00704A] text-white"
                              : "bg-white/85 text-gray-700",
                          )}
                        >
                          {n}
                        </span>
                        {evidence.has(n) && (
                          <span
                            aria-hidden
                            className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-[#00704A] ring-1 ring-white"
                          />
                        )}
                      </button>
                      {onRemove && (
                        <button
                          type="button"
                          onClick={() => onRemove(n - 1)}
                          aria-label={`사진 ${n} 빼기`}
                          className="absolute -right-1 -top-1 hidden h-[18px] w-[18px] items-center justify-center rounded-full bg-gray-900 text-[11px] font-bold leading-none text-white shadow group-hover:flex"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-xs leading-relaxed text-gray-600">
            항목에 마우스를 올리면 근거 사진이 녹색 테두리로 표시되고 그 위치로
            이동. 점은 판정 근거로 쓰인 사진. 누르면 확대(휠 줌).
          </p>
        </>
      )}
    </section>
  );
}

export function V2Sidebar({
  collapsed,
  onToggle,
  plan,
  ...photo
}: {
  collapsed: boolean;
  onToggle: () => void;
  plan: RepairPlan | null;
  urls: string[];
  highlighted: number[];
  evidence: Set<number>;
  selectedRefs: number[];
  onOpen: (photoNo: number, set: number[] | null) => void;
  onRemove?: (index: number) => void;
}) {
  return (
    <aside
      className={cx(
        "relative flex shrink-0 flex-col border-b border-[#D9DEE5] bg-[#F3F5F7] transition-[width] duration-200 ease-out lg:border-b-0 lg:border-r",
        collapsed ? "w-full lg:w-11" : "w-full lg:w-[344px]",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "수리 계획·사진 펼치기" : "수리 계획·사진 접기"}
        title={collapsed ? "수리 계획·사진 펼치기" : "왼쪽으로 접기"}
        className={cx(
          "z-[1] flex text-gray-700 transition-all hover:text-gray-900",
          collapsed
            ? "w-full items-start justify-start px-4 py-2.5 hover:bg-[#E9EDF1] lg:h-full lg:min-h-[200px] lg:justify-center lg:px-0 lg:py-0"
            : "w-full items-center px-4 py-2 hover:bg-[#E9EDF1] lg:absolute lg:-right-3 lg:top-4 lg:h-7 lg:w-6 lg:justify-center lg:rounded-md lg:border lg:border-[#C5CCD6] lg:bg-white lg:p-0 lg:shadow-[0_1px_2px_rgba(17,24,39,0.15)] lg:hover:bg-gray-50 lg:active:scale-95",
        )}
      >
        <span
          className={cx(
            "flex items-center gap-2",
            collapsed && "lg:sticky lg:top-0 lg:flex-col lg:py-4",
          )}
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cx("transition-transform", collapsed && "rotate-180")}
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
          {collapsed ? (
            <span className="text-xs font-bold lg:[writing-mode:vertical-rl]">
              수리 계획 · 사진 {photo.urls.length}
            </span>
          ) : (
            <span className="text-xs font-bold lg:hidden">
              수리 계획 · 사진 접기
            </span>
          )}
        </span>
      </button>
      {!collapsed && (
        <div className="flex min-h-0 flex-1 flex-col lg:sticky lg:top-0 lg:max-h-dvh lg:overflow-y-auto">
          {plan && <PlanSection plan={plan} />}
          <PhotoSection {...photo} />
        </div>
      )}
    </aside>
  );
}
