"use client";

import { useState } from "react";
import type {
  MinorPartInput,
  MinorPartName,
  MinorSide,
} from "@/lib/minor-types";

// 경미손상판독기 입력용 평면 도해도(위에서 본 차량, 앞이 위). 기준 적용대상 9개 외장부품만
// 클릭 가능하고 여러 부위를 동시에 고를 수 있다. 좌/우는 차량 기준(앞을 위로 두면 화면 왼쪽이 좌).
// 뒷면 중앙은 "트렁크/백도어" 하나로 두고 세단·SUV 구분은 모델이 사진으로 한다.

interface Region {
  part: MinorPartName;
  side: MinorSide;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  vertical?: boolean;
}

// viewBox 0 0 360 640. 차체 30~330 × 20~620
const BODY = { x: 30, y: 20, w: 300, h: 600, r: 70 };
const SIDE_W = 58;
const LX = BODY.x;
const RX = BODY.x + BODY.w - SIDE_W;
const CX = BODY.x + SIDE_W;
const CW = BODY.w - SIDE_W * 2;

const REGIONS: Region[] = [
  {
    part: "앞범퍼",
    side: "중앙",
    x: BODY.x,
    y: 20,
    w: BODY.w,
    h: 52,
    label: "앞범퍼",
  },
  { part: "후드", side: "중앙", x: CX, y: 72, w: CW, h: 130, label: "후드" },
  {
    part: "프런트펜더",
    side: "좌",
    x: LX,
    y: 72,
    w: SIDE_W,
    h: 150,
    label: "프런트펜더",
    vertical: true,
  },
  {
    part: "프런트펜더",
    side: "우",
    x: RX,
    y: 72,
    w: SIDE_W,
    h: 150,
    label: "프런트펜더",
    vertical: true,
  },
  {
    part: "프런트도어",
    side: "좌",
    x: LX,
    y: 222,
    w: SIDE_W,
    h: 130,
    label: "프런트도어",
    vertical: true,
  },
  {
    part: "프런트도어",
    side: "우",
    x: RX,
    y: 222,
    w: SIDE_W,
    h: 130,
    label: "프런트도어",
    vertical: true,
  },
  {
    part: "리어도어",
    side: "좌",
    x: LX,
    y: 352,
    w: SIDE_W,
    h: 110,
    label: "리어도어",
    vertical: true,
  },
  {
    part: "리어도어",
    side: "우",
    x: RX,
    y: 352,
    w: SIDE_W,
    h: 110,
    label: "리어도어",
    vertical: true,
  },
  {
    part: "리어펜더",
    side: "좌",
    x: LX,
    y: 462,
    w: SIDE_W,
    h: 106,
    label: "리어펜더",
    vertical: true,
  },
  {
    part: "리어펜더",
    side: "우",
    x: RX,
    y: 462,
    w: SIDE_W,
    h: 106,
    label: "리어펜더",
    vertical: true,
  },
  {
    part: "트렁크/백도어",
    side: "중앙",
    x: CX,
    y: 462,
    w: CW,
    h: 106,
    label: "트렁크/백도어",
  },
  {
    part: "뒤범퍼",
    side: "중앙",
    x: BODY.x,
    y: 568,
    w: BODY.w,
    h: 52,
    label: "뒤범퍼",
  },
];

export function partKey(p: MinorPartInput) {
  return `${p.part_name}|${p.side}`;
}

export function partLabel(p: MinorPartInput) {
  return p.side === "중앙" ? p.part_name : `${p.part_name}(${p.side})`;
}

export function CarPanelDiagram({
  value,
  onChange,
  disabled,
}: {
  value: MinorPartInput[];
  onChange: (next: MinorPartInput[]) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const selected = new Set(value.map(partKey));

  function resolve(r: Region): MinorPartInput {
    return { part_name: r.part, side: r.side };
  }

  function toggle(r: Region) {
    if (disabled) return;
    const p = resolve(r);
    const k = partKey(p);
    if (selected.has(k)) onChange(value.filter((v) => partKey(v) !== k));
    else onChange([...value, p]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          판독 부위 선택 (클릭, 복수 가능)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,260px)_1fr]">
        <svg
          viewBox="0 0 360 640"
          className="mx-auto w-full max-w-[260px] select-none"
          role="group"
          aria-label="차량 도해도"
        >
          <defs>
            <clipPath id="minor-body-clip">
              <rect
                x={BODY.x}
                y={BODY.y}
                width={BODY.w}
                height={BODY.h}
                rx={BODY.r}
              />
            </clipPath>
            <filter
              id="minor-glow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="6"
                floodColor="#059669"
                floodOpacity="0.55"
              />
            </filter>
          </defs>

          {/* 바퀴 */}
          {[
            [8, 110],
            [318, 110],
            [8, 470],
            [318, 470],
          ].map(([x, y]) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={34}
              height={90}
              rx={12}
              fill="#1e293b"
            />
          ))}

          {/* 차체 바닥 */}
          <rect
            x={BODY.x}
            y={BODY.y}
            width={BODY.w}
            height={BODY.h}
            rx={BODY.r}
            fill="#e2e8f0"
            stroke="#94a3b8"
            strokeWidth={2}
          />

          <g clipPath="url(#minor-body-clip)">
            {/* 유리·루프(선택 불가) */}
            <rect x={CX} y={202} width={CW} height={62} fill="#cbd5e1" />
            <rect x={CX} y={264} width={CW} height={150} fill="#f1f5f9" />
            <rect x={CX} y={414} width={CW} height={48} fill="#cbd5e1" />
            <text
              x={CX + CW / 2}
              y={344}
              textAnchor="middle"
              fontSize={12}
              fontWeight={700}
              fill="#94a3b8"
            >
              루프
            </text>

            {REGIONS.map((r) => {
              const p = resolve(r);
              const k = partKey(p);
              const on = selected.has(k);
              const hov = hover === k;
              const label = r.label;
              const cx = r.x + r.w / 2;
              const cy = r.y + r.h / 2;
              return (
                <g
                  key={k}
                  onClick={() => toggle(r)}
                  onMouseEnter={() => setHover(k)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: disabled ? "default" : "pointer" }}
                  filter={on ? "url(#minor-glow)" : undefined}
                >
                  <rect
                    x={r.x + 2}
                    y={r.y + 2}
                    width={r.w - 4}
                    height={r.h - 4}
                    rx={10}
                    fill={on ? "#059669" : hov ? "#a7f3d0" : "#ffffff"}
                    stroke={on ? "#047857" : hov ? "#34d399" : "#cbd5e1"}
                    strokeWidth={on ? 2.5 : 1.5}
                    style={{ transition: "fill 150ms, stroke 150ms" }}
                  />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={r.vertical ? 12 : 13}
                    fontWeight={800}
                    fill={on ? "#ffffff" : "#334155"}
                    transform={
                      r.vertical
                        ? `rotate(${r.side === "좌" ? -90 : 90} ${cx} ${cy})`
                        : undefined
                    }
                    style={{ pointerEvents: "none" }}
                  >
                    {label}
                  </text>
                  {on && (
                    <circle
                      cx={r.x + r.w - 12}
                      cy={r.y + 12}
                      r={6}
                      fill="#ffffff"
                      stroke="#047857"
                      strokeWidth={1.5}
                    />
                  )}
                </g>
              );
            })}
          </g>

          <text
            x={180}
            y={12}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fill="#94a3b8"
          >
            ▲ 앞
          </text>
          <text
            x={12}
            y={330}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fill="#94a3b8"
            transform="rotate(-90 12 330)"
          >
            좌(운전석)
          </text>
          <text
            x={348}
            y={330}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fill="#94a3b8"
            transform="rotate(90 348 330)"
          >
            우(조수석)
          </text>
        </svg>

        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            선택된 부위 {value.length ? `(${value.length})` : ""}
          </p>
          {value.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center text-xs text-slate-400">
              도해도에서 판독할 외판 부위를 눌러주세요.
              <br />
              범퍼·후드·펜더·도어·트렁크/백도어
            </div>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {value.map((p, i) => (
                <li
                  key={partKey(p)}
                  className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900 shadow-[inset_0_1px_2px_rgba(5,150,105,0.12)]"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] text-white">
                    {i + 1}
                  </span>
                  <span className="flex-1">{partLabel(p)}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange(value.filter((v) => partKey(v) !== partKey(p)))
                      }
                      className="rounded-full px-1.5 text-xs text-emerald-600 transition-colors hover:bg-emerald-100 hover:text-emerald-900"
                      title="선택 해제"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
          <p className="mt-auto text-[11px] leading-relaxed text-slate-400">
            좌/우는 차량 기준(운전석 쪽이 좌). 사진은 부위마다 정면·비스듬한
            각도·근접 컷이 있으면 판독 정확도가 올라갑니다.
          </p>
        </div>
      </div>
    </div>
  );
}
