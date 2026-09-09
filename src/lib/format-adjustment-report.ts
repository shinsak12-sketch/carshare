import type { AdjustmentCaseInfo, AdjustmentResult } from "./adjustment-types";

export function buildAdjustmentReportText(caseInfo: AdjustmentCaseInfo, result: AdjustmentResult): string {
  const lines: string[] = ["AI 손해사정 검토 (보조 의견)", ""];

  if (caseInfo.manufacturer || caseInfo.model) {
    lines.push(`차량: ${caseInfo.manufacturer ?? ""} ${caseInfo.model ?? ""}`.trim());
    lines.push("");
  }

  if (!result.physical_consistency.consistent) {
    lines.push(`⚠ 사고 정합성 경고: ${result.physical_consistency.warning}`);
    lines.push("");
  }

  lines.push("[청구 항목별 검토]");
  result.items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.item_name} (청구: ${item.claimed_action}) → ${item.verdict}`);
    lines.push(`   ${item.reasoning}`);
    if (item.verdict !== "인정" && item.adjustment_note) {
      lines.push(`   조정의견: ${item.adjustment_note}`);
    }
  });
  lines.push("");

  lines.push("종합 의견");
  lines.push(result.overall_opinion);

  return lines.join("\n");
}
