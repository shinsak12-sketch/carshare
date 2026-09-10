import type { AdjustmentItem, AdjustmentResult } from "./adjustment-types";
import { isMinorDamageType, type VerdictLabel } from "./review-items";

// 린터 출력처럼 문제 항목만 앞에 세우기 위한 심각도.
// error = 돈이 나가면 안 되는 것(불인정·과다청구), warn = 확인이 필요한 것(협의·조사),
// pass = 통과(기본 접힘)
export type DiagnosticSeverity = "error" | "warn" | "pass";

export function severityOf(verdict: VerdictLabel): DiagnosticSeverity {
  if (verdict === "불인정" || verdict === "과다청구") return "error";
  if (verdict === "협의필요" || verdict === "조사필요") return "warn";
  return "pass";
}

export type AdjustmentDiagnostic =
  | {
      id: string;
      kind: "consistency";
      severity: DiagnosticSeverity;
      verdict: VerdictLabel;
      title: string;
      message: string;
    }
  | {
      id: string;
      kind: "item";
      severity: DiagnosticSeverity;
      verdict: VerdictLabel;
      lineNo: number;
      damageType?: string;
      item: AdjustmentItem;
    };

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = { error: 0, warn: 1, pass: 2 };

// 심각도 → 견적서 줄 번호 순으로 정렬. 정합성 경고는 항상 맨 위.
export function buildAdjustmentDiagnostics(result: AdjustmentResult): AdjustmentDiagnostic[] {
  const list: AdjustmentDiagnostic[] = [];

  if (!result.physical_consistency.consistent) {
    list.push({
      id: "consistency",
      kind: "consistency",
      severity: "warn",
      verdict: "조사필요",
      title: "사고 정합성 / 차량 동일성 경고",
      message: result.physical_consistency.warning,
    });
  }

  result.items.forEach((item, i) => {
    list.push({
      id: `item-${i}`,
      kind: "item",
      severity: severityOf(item.verdict),
      verdict: item.verdict,
      lineNo: item.line_no,
      damageType: isMinorDamageType(item.damage_type ?? undefined) ? item.damage_type ?? undefined : undefined,
      item,
    });
  });

  return list.sort((a, b) => {
    if (a.kind === "consistency") return -1;
    if (b.kind === "consistency") return 1;
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return s !== 0 ? s : a.lineNo - b.lineNo;
  });
}
