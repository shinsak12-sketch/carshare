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

  lines.push("[손상 부위]");
  result.damaged_parts.forEach((part) => {
    lines.push(`- ${part.part_name} (${part.damage_type}): ${part.reasoning}`);
  });
  lines.push("");

  lines.push("[작업 공정]");
  result.process_stages.forEach((stage) => {
    lines.push(stage.stage_name);
    stage.steps.forEach((step, i) => {
      lines.push(`  ${i + 1}. ${step.title} — ${step.detail}`);
    });
    lines.push("");
  });

  lines.push("종합 요약");
  lines.push(result.overall_summary);

  return lines.join("\n");
}
