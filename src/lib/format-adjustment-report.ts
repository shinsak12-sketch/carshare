import type { AdjustmentCaseInfo, AdjustmentResult } from "./adjustment-types";
import {
  buildAdjustmentDiagnostics,
  type ItemDiagnostic,
} from "./adjustment-review-items";

const GLYPH = { error: "✖", warn: "⚠", pass: "✔" } as const;

function rowText(d: ItemDiagnostic, isMain: boolean): string[] {
  const it = d.item;
  const follows = it.follows_parent && !isMain;
  const hours = it.claimed_hours != null ? ` ${it.claimed_hours}H` : "";
  const indent = isMain ? "" : "    ";
  const mark = follows ? "↳" : GLYPH[d.severity];
  const role = !isMain && it.role !== "메인" ? `[${it.role}] ` : "";
  const head = `${indent}${mark} ${String(d.lineNo).padStart(3)}  ${role}${it.item_name} · ${it.claimed_action}${hours}  → ${follows ? "연동" : it.verdict}`;
  if (follows)
    return it.adjustment_note
      ? [head, `${indent}        → ${it.adjustment_note}`]
      : [head];
  const refs = it.photo_refs.length
    ? ` · 근거사진 ${it.photo_refs.join(", ")}`
    : "";
  return [
    head,
    `${indent}        ${it.reasoning}${it.adjustment_note ? ` → ${it.adjustment_note}` : ""}${refs}`,
  ];
}

// 린터 출력 형식: 문제 브랜치(✖ → ⚠)만 먼저 트리로, 통과는 건수 + 목록.
export function buildAdjustmentReportText(
  caseInfo: AdjustmentCaseInfo,
  result: AdjustmentResult,
): string {
  const lines: string[] = ["AI 손해사정 검토 (보조 의견)", ""];

  if (caseInfo.manufacturer || caseInfo.model) {
    lines.push(
      `차량: ${caseInfo.manufacturer ?? ""} ${caseInfo.model ?? ""}`.trim(),
    );
    lines.push("");
  }

  const { consistency, branches, counts } = buildAdjustmentDiagnostics(result);
  lines.push(`✖ ${counts.error}  ⚠ ${counts.warn}  ✔ ${counts.pass}`);
  lines.push("");

  if (consistency) {
    lines.push(`⚠  --  ${consistency.title}`);
    lines.push(`       ${consistency.message}`);
    lines.push("");
  }

  const problems = branches.filter((b) => b.severity !== "pass");
  const passed = branches.filter((b) => b.severity === "pass");

  if (problems.length === 0) {
    lines.push("조정 필요 항목 없음");
  } else {
    lines.push("[조정 필요]");
    for (const b of problems) {
      lines.push(`${GLYPH[b.severity]} ${b.label}`);
      if (b.main) lines.push(...rowText(b.main, true));
      for (const c of b.children) lines.push(...rowText(c, false));
      lines.push("");
    }
  }

  lines.push(`[통과 ${counts.pass}건]`);
  for (const b of passed) {
    const all = [b.main, ...b.children].filter(
      (d): d is ItemDiagnostic => d !== null,
    );
    for (const d of all) {
      const it = d.item;
      const hours = it.claimed_hours != null ? ` ${it.claimed_hours}H` : "";
      lines.push(
        `✔  ${String(d.lineNo).padStart(3)}  ${b.label} › ${it.item_name} · ${it.claimed_action}${hours}`,
      );
    }
  }

  return lines.join("\n");
}
