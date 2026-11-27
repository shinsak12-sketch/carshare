// 손해사정 v2 화면 공용 조각 — 색·버튼 모양을 한 곳에서 맞춤
export const won = (n: number | null | undefined) =>
  n == null ? "" : Math.round(n).toLocaleString("ko-KR");

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

// 양각 버튼(기본) / 눌린 상태는 inset 그림자
export const BTN =
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-[#C5CCD6] bg-white px-3 text-xs font-bold text-gray-900 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(17,24,39,0.1)] transition-all duration-150 hover:-translate-y-px hover:bg-gray-50 active:translate-y-0 active:scale-[0.97] active:shadow-[inset_0_2px_4px_rgba(17,24,39,0.18)] disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_DARK =
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-gray-900 px-3 text-xs font-bold text-white shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_6px_12px_-6px_rgba(17,24,39,0.7)] transition-all duration-150 hover:-translate-y-px hover:bg-gray-800 active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_ACCENT =
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-[#00704A] px-3 text-xs font-bold text-white shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_6px_12px_-6px_rgba(0,112,74,0.7)] transition-all duration-150 hover:-translate-y-px hover:bg-[#005f3f] active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";
// 음각 입력칸
export const INPUT =
  "h-9 w-full rounded-lg border border-[#C5CCD6] bg-[#F3F5F7] px-2.5 text-sm text-gray-900 shadow-[inset_0_1px_2px_rgba(17,24,39,0.12)] outline-none transition-colors focus:border-[#00704A] focus:bg-white";
// 음각 세그먼트(둘 중 하나 고르기) 바탕
export const SEG_WRAP =
  "flex gap-1 rounded-[9px] bg-[#E8EBEF] p-[3px] shadow-[inset_0_1px_2px_rgba(17,24,39,0.15)]";
export const segBtn = (on: boolean) =>
  cx(
    "h-7 rounded-[7px] px-2.5 text-xs transition-all",
    on
      ? "bg-white font-bold text-gray-900 shadow-[0_1px_2px_rgba(17,24,39,0.2)]"
      : "font-medium text-gray-700 hover:text-gray-900",
  );

// 판정 배지 색(연한 바탕 + 진한 글자)
export const VERDICT_TONE: Record<string, string> = {
  인정: "border-[#8CC7AD] bg-[#E7F4EE] text-[#00593B]",
  과다청구: "border-[#F3B27A] bg-[#FFF1E0] text-[#93370D]",
  협의필요: "border-[#9DB7F5] bg-[#E8EFFE] text-[#1E40AF]",
  조사필요: "border-[#9DB7F5] bg-[#E8EFFE] text-[#1E40AF]",
  불인정: "border-[#F1A9A0] bg-[#FDECEA] text-[#912018]",
};
export const NEUTRAL_TONE = "border-gray-300 bg-gray-100 text-gray-600";

// 작업 구분 배지 색
export const KIND_COLOR: Record<string, string> = {
  교환: "#BE123C",
  탈착: "#374151",
  판금: "#C2410C",
  수리: "#92400E",
  교정: "#0F766E",
  도장: "#0369A1",
  부품: "#6B4E16",
  기타: "#4B5563",
};
export const kindColor = (k: string) => KIND_COLOR[k] ?? "#4B5563";

export function confidenceTone(v: number) {
  if (v >= 90) return "border-[#8CC7AD] bg-[#E7F4EE] text-[#00593B]";
  if (v >= 70) return "border-gray-300 bg-gray-50 text-gray-700";
  if (v >= 50) return "border-[#F3B27A] bg-[#FFF1E0] text-[#93370D]";
  return "border-[#F1A9A0] bg-[#FDECEA] text-[#912018]";
}
