"use client";

import type { MinorClass } from "@/lib/minor-types";

// 경미손상판독 결과 카드의 시각 요소.
// 1) 손상 깊이 단면: 투명막 → 도장막 → 소재 3층에 손상이 어디까지 닿았는지
// 2) 유형 단계: 1유형(광택) → 2유형(도장) → 3유형(판금·퍼티) → 기타손상(교환)
// 두 그림 모두 유형(classification)에서 바로 그려지므로 모델 출력이 늘지 않는다.

export const CLASS_HEX: Record<MinorClass, string> = {
  "1유형": "#0284c7",
  "2유형": "#2563eb",
  "3유형": "#d97706",
  기타손상: "#dc2626",
  손상없음: "#059669",
  판독불가: "#64748b",
};

const STEPS: { cls: MinorClass; short: string; fix: string }[] = [
  { cls: "1유형", short: "1유형", fix: "광택" },
  { cls: "2유형", short: "2유형", fix: "도장" },
  { cls: "3유형", short: "3유형", fix: "판금·퍼티" },
  { cls: "기타손상", short: "기타손상", fix: "교환 검토" },
];

// 손상이 닿는 깊이(단면 y). 층: 투명막 18~36, 도장막 36~60, 소재 60~100
const DEPTH: Partial<Record<MinorClass, number>> = {
  "1유형": 31,
  "2유형": 54,
  "3유형": 82,
  기타손상: 104,
};

export function DamageLayerDiagram({
  cls,
  compact,
}: {
  cls: MinorClass;
  compact?: boolean;
}) {
  const depth = DEPTH[cls];
  const color = CLASS_HEX[cls];
  const W = 220;
  const cx = 138;
  const half = cls === "기타손상" ? 26 : cls === "3유형" ? 22 : 18;
  return (
    <svg
      viewBox={`0 0 ${W} 112`}
      className={compact ? "h-[64px] w-auto" : "h-auto w-full max-w-[220px]"}
      role="img"
      aria-label={`손상 깊이 단면: ${cls}`}
    >
      <defs>
        <clipPath id={`minor-layers-${compact ? "c" : "f"}`}>
          <rect x={56} y={18} width={W - 60} height={82} rx={6} />
        </clipPath>
      </defs>
      {/* 층 */}
      <g clipPath={`url(#minor-layers-${compact ? "c" : "f"})`}>
        <rect x={56} y={18} width={W} height={18} fill="#e0f2fe" />
        <rect x={56} y={36} width={W} height={24} fill="#93c5fd" />
        <rect x={56} y={60} width={W} height={40} fill="#cbd5e1" />
        {/* 소재 해칭 */}
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={i}
            x1={56 + i * 20}
            y1={100}
            x2={56 + i * 20 + 16}
            y2={60}
            stroke="#94a3b8"
            strokeWidth={1}
            opacity={0.5}
          />
        ))}
        {/* 손상 홈 */}
        {depth && (
          <>
            <path
              d={`M ${cx - half} 18 Q ${cx - half * 0.35} ${depth} ${cx} ${depth} Q ${cx + half * 0.35} ${depth} ${cx + half} 18 Z`}
              fill="#fecaca"
              stroke={color}
              strokeWidth={2}
            />
            {cls === "기타손상" && (
              <path
                d={`M ${cx} ${depth - 6} l -5 8 l 8 6 l -6 9`}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
              />
            )}
          </>
        )}
        {cls === "판독불가" && (
          <text
            x={cx}
            y={66}
            textAnchor="middle"
            fontSize={22}
            fontWeight={900}
            fill="#64748b"
          >
            ?
          </text>
        )}
        {cls === "손상없음" && (
          <text
            x={cx}
            y={64}
            textAnchor="middle"
            fontSize={20}
            fontWeight={900}
            fill="#059669"
          >
            ✓
          </text>
        )}
      </g>
      <rect
        x={56}
        y={18}
        width={W - 60}
        height={82}
        rx={6}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={1}
      />
      {/* 라벨 */}
      {[
        ["투명막", 30, "1유형"],
        ["도장막", 51, "2유형"],
        ["소재", 83, "3유형"],
      ].map(([label, y, at]) => {
        const reached =
          depth != null && depth >= Number(y) - 8 && cls !== "손상없음";
        return (
          <text
            key={label}
            x={50}
            y={Number(y)}
            textAnchor="end"
            fontSize={10}
            fontWeight={reached ? 800 : 600}
            fill={reached ? color : "#64748b"}
          >
            {label}
            {reached && at === cls ? " ◀" : ""}
          </text>
        );
      })}
    </svg>
  );
}

export function TypeStepper({ cls }: { cls: MinorClass }) {
  const idx = STEPS.findIndex((s) => s.cls === cls);
  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-stretch gap-1">
        <div className="pointer-events-none absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-sky-300 via-amber-300 to-red-400 opacity-40" />
        {STEPS.map((s, i) => {
          const on = i === idx;
          const before = idx >= 0 && i < idx;
          return (
            <div
              key={s.cls}
              className={`relative flex flex-1 flex-col items-center rounded-xl px-1 py-1.5 text-center transition-all ${
                on
                  ? "scale-105 text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)]"
                  : before
                    ? "bg-white/80 text-slate-500"
                    : "bg-white/80 text-slate-400"
              }`}
              style={on ? { background: CLASS_HEX[s.cls] } : undefined}
            >
              <span className="text-[11px] font-black leading-tight">
                {s.short}
              </span>
              <span
                className={`text-[9px] font-semibold leading-tight ${on ? "text-white/85" : ""}`}
              >
                {s.fix}
              </span>
            </div>
          );
        })}
      </div>
      {idx < 0 && (
        <p className="text-center text-[10px] font-bold text-slate-500">
          {cls === "손상없음"
            ? "해당 부위에 손상이 확인되지 않음"
            : "사진으로 유형 판별 불가"}
        </p>
      )}
    </div>
  );
}

export function ConditionSummary({
  conditions,
}: {
  conditions: { status: string }[];
}) {
  const n = (s: string) => conditions.filter((c) => c.status === s).length;
  const hit = n("해당");
  const unk = n("확인 불가");
  const no = n("해당 없음");
  return (
    <div className="flex items-center gap-1 text-[10px] font-bold">
      <span
        className={`rounded-full px-2 py-0.5 ${hit ? "bg-red-600 text-white" : "bg-slate-100 text-slate-400"}`}
      >
        해당 {hit}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 ${unk ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-400"}`}
      >
        확인 불가 {unk}
      </span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
        해당 없음 {no}
      </span>
    </div>
  );
}
