import type { AdjustmentCaseInfo, AdjustmentResult } from "./adjustment-types";
import { buildAdjustmentDiagnostics } from "./adjustment-review-items";

// 린터 출력 형식: 문제 항목(✖ → ⚠)만 줄 번호와 함께 먼저, 통과는 건수 + 목록.
export function buildAdjustmentReportText(caseInfo: AdjustmentCaseInfo, result: AdjustmentResult): string {
  const lines: string[] = ["AI 손해사정 검토 (보조 의견)", ""];

  if (caseInfo.manufacturer || caseInfo.model) {
    lines.push(`차량: ${caseInfo.manufacturer ?? ""} ${caseInfo.model ?? ""}`.trim());
    lines.push("");
  }

  const diags = buildAdjustmentDiagnostics(result);
  const problems = diags.filter((d) => d.severity !== "pass");
  const passed = diags.filter((d) => d.severity === "pass");

  lines.push(
    `✖ ${diags.filter((d) => d.severity === "error").length}  ⚠ ${diags.filter((d) => d.severity === "warn").length}  ✔ ${passed.length}`
  );
  lines.push("");

  if (problems.length === 0) {
    lines.push("조정 필요 항목 없음");
  } else {
    lines.push("[조정 필요 항목]");
    for (const d of problems) {
      const mark = d.severity === "error" ? "✖" : "⚠";
      if (d.kind === "consistency") {
        lines.push(`${mark}  --  ${d.title}`);
        lines.push(`       ${d.message}`);
        continue;
      }
      const it = d.item;
      const hours = it.claimed_hours != null ? ` ${it.claimed_hours}H` : "";
      lines.push(`${mark}  ${String(d.lineNo).padStart(3)}  ${it.item_name} · ${it.claimed_action}${hours}  → ${it.verdict}`);
      const refs = it.photo_refs.length ? ` · 근거사진 ${it.photo_refs.join(", ")}` : "";
      lines.push(`       ${it.reasoning}${it.adjustment_note ? ` → ${it.adjustment_note}` : ""}${refs}`);
    }
  }
  lines.push("");

  lines.push(`[통과 ${passed.length}건]`);
  for (const d of passed) {
    if (d.kind !== "item") continue;
    const it = d.item;
    const hours = it.claimed_hours != null ? ` ${it.claimed_hours}H` : "";
    lines.push(`✔  ${String(d.lineNo).padStart(3)}  ${it.item_name} · ${it.claimed_action}${hours} — ${it.reasoning}`);
  }
  lines.push("");

  lines.push("종합 의견");
  lines.push(result.overall_opinion);

  return lines.join("\n");
}
