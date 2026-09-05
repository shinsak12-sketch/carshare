import type { ProcedureResult } from "./procedure-types";

export interface ProcedureCaseInfo {
  manufacturer?: string;
  model?: string;
}

export function buildProcedureSummaryText(result: ProcedureResult): string {
  return result.overall_summary;
}

export function buildProcedureReportText(caseInfo: ProcedureCaseInfo, result: ProcedureResult): string {
  const lines: string[] = ["정비공정 사전판단 (AI, 선견적 이전 참고용)", ""];

  if (caseInfo.manufacturer || caseInfo.model) {
    lines.push(`차량: ${caseInfo.manufacturer ?? ""} ${caseInfo.model ?? ""}`.trim());
    lines.push("");
  }

  if (!result.physical_consistency.consistent) {
    lines.push(`⚠ 사고 정합성 경고: ${result.physical_consistency.warning}`);
    lines.push("");
  }

  result.parts.forEach((part, i) => {
    lines.push(`${i + 1}. ${part.part_name} — ${part.damage_type}`);
    lines.push(`권장 작업: ${part.recommended_action}`);
    lines.push(part.reasoning);
    lines.push(`  작업시간 참고: ${part.labor_estimate_note}`);
    if (part.ancillary_work.length > 0) {
      lines.push("  부수작업:");
      for (const a of part.ancillary_work) {
        lines.push(`  · ${a.item}: ${a.note}`);
      }
    }
    lines.push("");
  });

  lines.push("종합 요약");
  lines.push(result.overall_summary);

  return lines.join("\n");
}
