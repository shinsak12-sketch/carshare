export const krw = (n: number | null | undefined) =>
  n == null ? "-" : `${Math.round(n).toLocaleString("ko-KR")}원`;
export const num = (n: number | null | undefined) =>
  n == null ? "-" : n.toLocaleString("ko-KR");
export const tok = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}k`
      : String(n);
export const dt = (d: Date) =>
  d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
