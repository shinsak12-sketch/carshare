import type { AdjustmentCaseInfo, AdjustmentResult } from "./adjustment-types";
import {
  buildAdjustmentDiagnostics,
  type ItemDiagnostic,
} from "./adjustment-review-items";
import type { AmountSummary } from "./adjustment-amounts";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

const GLYPH = { error: "✖", warn: "⚠", pass: "✔" } as const;

function rowText(d: ItemDiagnostic, isMain: boolean): string[] {
  const it = d.view;
  const follows = it.followsParent && !isMain;
  const hours = it.claimedHours != null ? ` ${it.claimedHours}H` : "";
  const indent = isMain ? "" : "    ";
  const mark = follows ? "↳" : GLYPH[d.severity];
  const role = !isMain && it.roleLabel !== "메인" ? `[${it.roleLabel}] ` : "";
  const no = d.lineNo != null ? String(d.lineNo).padStart(3) : "   ";
  const basis = !follows && it.basis === "추론" ? " [추론]" : "";
  const conf =
    !follows && typeof it.confidence === "number" ? ` ${it.confidence}%` : "";
  const over =
    it.override && it.aiVerdict
      ? ` (${it.override.cascaded ? "연쇄" : "담당자 수정"}: AI ${it.aiVerdict})`
      : "";
  const head = `${indent}${mark} ${no}  ${role}${it.itemName} · ${it.claimedAction}${hours}  → ${follows ? "연동" : it.verdict}${conf}${basis}${over}`;
  if (follows)
    return it.note ? [head, `${indent}        → ${it.note}`] : [head];
  const refs = it.photoRefs.length
    ? ` · 근거사진 ${it.photoRefs.join(", ")}`
    : "";
  const lines = [
    head,
    `${indent}        ${it.reasoning}${it.note ? ` → ${it.note}` : ""}${refs}`,
  ];
  for (const x of it.extras)
    lines.push(`${indent}        [${x.label}] ${x.text}`);
  if (it.costComparison) {
    const c = it.costComparison;
    lines.push(`${indent}        [교환 vs 수리 비교]`);
    lines.push(`${indent}          교환안(청구서): ${c.replace_option}`);
    lines.push(`${indent}          수리안(추정): ${c.repair_option}`);
    lines.push(`${indent}          → ${c.recommendation}`);
  }
  return lines;
}

// 린터 출력 형식: 문제 브랜치(✖ → ⚠)만 먼저 트리로, 통과는 건수 + 목록.
export function buildAdjustmentReportText(
  caseInfo: AdjustmentCaseInfo,
  result: AdjustmentResult,
  amounts?: AmountSummary | null,
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
  const overridden = result.items.filter(
    (it) => it.override && !it.override.cascaded,
  ).length;
  if (overridden > 0) lines.push(`담당자 수정 ${overridden}건 반영`);
  lines.push("");

  if (amounts) {
    lines.push("[금액 비교]");
    lines.push(
      `청구 ${won(amounts.claimedTotal)} (공임 ${won(amounts.claimedLabor)} · 부품 ${won(amounts.claimedPart)})`,
    );
    lines.push(
      `AI 사정 ${won(amounts.assessedTotal)} (공임 ${won(amounts.assessedLabor)} · 부품 ${won(amounts.assessedPart)})`,
    );
    lines.push(
      `삭감 ${won(amounts.cut)} (${Math.round(amounts.cutRate * 100)}%)${amounts.held > 0 ? ` · 보류(협의·조사) ${won(amounts.held)}` : ""}${amounts.pendingHours > 0 ? ` · 금액 확인 ${amounts.pendingHours}건(조정 시간 미확정)` : ""}`,
    );
    lines.push("");
  }

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
      const it = d.view;
      const hours = it.claimedHours != null ? ` ${it.claimedHours}H` : "";
      const no = d.lineNo != null ? String(d.lineNo).padStart(3) : "   ";
      lines.push(
        `✔  ${no}  ${b.label} › ${it.itemName} · ${it.claimedAction}${hours}`,
      );
    }
  }

  return lines.join("\n");
}
