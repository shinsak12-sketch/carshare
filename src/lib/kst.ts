// 서버(Vercel)는 UTC라 날짜 경계·표시를 전부 한국시간(Asia/Seoul) 기준으로 맞춘다.
const TZ = "Asia/Seoul";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// "YYYY-MM-DD" (KST)
export function kstDayKey(d: Date): string {
  return partsFmt.format(d);
}

// KST 자정 / 월초를 UTC Date로
export function kstDayStart(d = new Date()): Date {
  return new Date(`${kstDayKey(d)}T00:00:00+09:00`);
}
export function kstMonthStart(d = new Date()): Date {
  return new Date(`${kstDayKey(d).slice(0, 7)}-01T00:00:00+09:00`);
}

export function fmtKst(
  d: Date | string,
  opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
): string {
  return new Date(d).toLocaleString("ko-KR", { timeZone: TZ, ...opts });
}
