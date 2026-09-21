import {
  MINOR_CLASS_LABEL,
  type MinorCaseInfo,
  type MinorResult,
} from "./minor-types";

// 경미손상판독 결과 → 복사용 텍스트(부위별 회신문 + 근거)
export function minorPartHeading(p: {
  part_name: string;
  side: string;
}): string {
  return p.side === "중앙" ? p.part_name : `${p.part_name}(${p.side})`;
}

export function buildMinorReportText(
  info: MinorCaseInfo,
  r: MinorResult,
): string {
  const lines: string[] = [];
  const vehicle = [
    info.manufacturer,
    info.model,
    info.year && `${info.year}년식`,
  ]
    .filter(Boolean)
    .join(" ");
  lines.push("[경미손상 판독 결과]");
  if (info.plateNo) lines.push(`차량번호: ${info.plateNo}`);
  if (vehicle) lines.push(`차종: ${vehicle}`);
  if (r.vehicle_note) lines.push(`※ ${r.vehicle_note}`);
  lines.push("");
  r.parts.forEach((p, i) => {
    lines.push(
      `${i + 1}. ${minorPartHeading(p)} — ${MINOR_CLASS_LABEL[p.classification] ?? p.classification} (근거 확신 ${p.evidence_confidence})`,
    );
    lines.push(p.report_text);
    if (p.observations.length) {
      lines.push("  · 관찰:");
      for (const o of p.observations)
        lines.push(
          `    - ${o.what} / ${o.location}${o.photo_refs.length ? ` (사진 ${o.photo_refs.join(", ")})` : ""}`,
        );
    }
    lines.push(`  · 판정 근거: ${p.key_evidence}`);
    const hit = p.exchange_conditions.filter((c) => c.status !== "해당 없음");
    if (hit.length) {
      lines.push("  · 교환 조건:");
      for (const c of hit)
        lines.push(
          `    - [${c.status}] ${c.condition}${c.note ? ` — ${c.note}` : ""}`,
        );
    }
    lines.push(`  · 기준상 수리방법: ${p.repair_method}`);
    if (p.additional_photos.length)
      lines.push(`  · 추가 확인 필요: ${p.additional_photos.join(", ")}`);
    lines.push("");
  });
  lines.push(
    "근거: 자동차보험 표준약관 제21조 제4항·별표 2, 보험개발원 경미손상 수리기준.",
  );
  return lines.join("\n").trimEnd();
}
