import {
  CAR_DIAGRAM_BODY,
  CAR_DIAGRAM_VIEWBOX,
  CAR_DIAGRAM_WHEELS,
  DIAGRAM_ZONES,
  matchDiagramZones,
} from "@/lib/damage-diagram-zones";
import type { DamagedPartSummary, SuspectedHiddenDamage } from "@/lib/procedure-types";

type ZoneStatus = "confirmed" | "suspected";

export function DamageDiagram({
  damagedParts,
  suspectedHiddenDamage,
}: {
  damagedParts: DamagedPartSummary[];
  suspectedHiddenDamage: SuspectedHiddenDamage[];
}) {
  const zoneStatus = new Map<string, ZoneStatus>();
  const unmatched: string[] = [];

  for (const part of damagedParts) {
    if (part.damage_type === "손상없음") continue; // 램프류 등 "확인했지만 이상 없음" 항목 — 도해에 손상으로 표시하면 안 됨
    const ids = matchDiagramZones(part.part_name, part.side);
    if (ids.length === 0) unmatched.push(part.part_name);
    for (const id of ids) zoneStatus.set(id, "confirmed");
  }
  for (const issue of suspectedHiddenDamage) {
    const ids = matchDiagramZones(issue.item, issue.side);
    if (ids.length === 0) unmatched.push(issue.item);
    for (const id of ids) {
      if (zoneStatus.get(id) !== "confirmed") zoneStatus.set(id, "suspected");
    }
  }

  function styleFor(status: ZoneStatus | undefined, dashed?: boolean) {
    if (status === "confirmed") return { fill: "#F87171", stroke: "#B91C1C" };
    if (status === "suspected") return { fill: "#FDE68A", stroke: "#B45309" };
    return { fill: dashed ? "none" : "#F8FAFC", stroke: "#E2E8F0" };
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="mx-auto w-full max-w-[200px]">
        <svg viewBox={CAR_DIAGRAM_VIEWBOX} role="img" aria-label="차량 평면도 위에 확인된 손상과 정밀점검이 필요한 추정 손상 위치를 표시한 도해">
          <rect
            x={CAR_DIAGRAM_BODY.x}
            y={CAR_DIAGRAM_BODY.y}
            width={CAR_DIAGRAM_BODY.w}
            height={CAR_DIAGRAM_BODY.h}
            rx={CAR_DIAGRAM_BODY.rx}
            fill="none"
            stroke="#CBD5E1"
            strokeWidth={2}
          />
          {DIAGRAM_ZONES.map((zone) => {
            const status = zoneStatus.get(zone.id);
            const style = styleFor(status, zone.dashed);
            return (
              <rect
                key={zone.id}
                x={zone.x}
                y={zone.y}
                width={zone.w}
                height={zone.h}
                rx={3}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={status ? 1.6 : 1}
                strokeDasharray={zone.dashed ? "3 2" : undefined}
              >
                <title>
                  {zone.label}
                  {status === "confirmed" ? " — 확인된 손상" : status === "suspected" ? " — 정밀점검 필요(추정)" : ""}
                </title>
              </rect>
            );
          })}
          {CAR_DIAGRAM_WHEELS.map((wheel, i) => (
            <circle key={i} cx={wheel.cx} cy={wheel.cy} r={20} fill="#334155" opacity={0.85} />
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-medium text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> 확인된 손상
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-amber-600 bg-amber-200" /> 정밀점검 필요(추정)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-slate-50" /> 이상 없음
        </span>
      </div>

      {unmatched.length > 0 && (
        <p className="text-center text-[11px] text-slate-400">도해에 표시되지 않은 항목: {unmatched.join(", ")}</p>
      )}
    </div>
  );
}
