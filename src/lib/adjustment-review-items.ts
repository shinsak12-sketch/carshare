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

export interface ItemDiagnostic {
  id: string;
  severity: DiagnosticSeverity;
  verdict: VerdictLabel;
  lineNo: number;
  damageType?: string;
  item: AdjustmentItem;
}

// 브랜치 = 메인 부품/부위 단위. 메인 행 + 부품/도장/부수 자식 행.
// 집계(✖/⚠/✔ 건수)는 독립 판정(follows_parent=false)만 센다 — 부품·교환도장이
// 메인 판정에 딸려오는 걸 개별 불인정으로 세면 몇십 개씩 부풀어서.
export interface DiagnosticBranch {
  id: string;
  label: string;
  severity: DiagnosticSeverity;
  main: ItemDiagnostic | null;
  children: ItemDiagnostic[];
}

export interface AdjustmentDiagnostics {
  consistency: { severity: "warn"; verdict: VerdictLabel; title: string; message: string } | null;
  branches: DiagnosticBranch[];
  counts: Record<DiagnosticSeverity, number>;
}

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = { error: 0, warn: 1, pass: 2 };
const ROLE_ORDER: Record<AdjustmentItem["role"], number> = { 메인: 0, 부품: 1, 도장: 2, 부수: 3 };

function toDiagnostic(item: AdjustmentItem, i: number): ItemDiagnostic {
  return {
    id: `item-${i}`,
    severity: severityOf(item.verdict),
    verdict: item.verdict,
    lineNo: item.line_no,
    damageType: isMinorDamageType(item.damage_type ?? undefined) ? item.damage_type ?? undefined : undefined,
    item,
  };
}

export function buildAdjustmentDiagnostics(result: AdjustmentResult): AdjustmentDiagnostics {
  const counts: Record<DiagnosticSeverity, number> = { error: 0, warn: 0, pass: 0 };

  const consistency = result.physical_consistency.consistent
    ? null
    : {
        severity: "warn" as const,
        verdict: "조사필요" as VerdictLabel,
        title: "사고 정합성 / 차량 동일성 경고",
        message: result.physical_consistency.warning,
      };
  if (consistency) counts.warn += 1;

  const byGroup = new Map<string, ItemDiagnostic[]>();
  result.items.forEach((item, i) => {
    const d = toDiagnostic(item, i);
    if (!item.follows_parent) counts[d.severity] += 1;
    const key = item.group || item.item_name;
    const list = byGroup.get(key) ?? [];
    list.push(d);
    byGroup.set(key, list);
  });

  const branches: DiagnosticBranch[] = [...byGroup.entries()].map(([label, list], gi) => {
    list.sort((a, b) => ROLE_ORDER[a.item.role] - ROLE_ORDER[b.item.role] || a.lineNo - b.lineNo);
    const mainIdx = list.findIndex((d) => d.item.role === "메인");
    const main = mainIdx >= 0 ? list[mainIdx] : null;
    const children = list.filter((_, idx) => idx !== mainIdx);
    // 브랜치 심각도 = 독립 판정 중 가장 심한 것
    const independent = list.filter((d) => !d.item.follows_parent);
    const severity = (independent.length ? independent : list)
      .map((d) => d.severity)
      .reduce<DiagnosticSeverity>((acc, s) => (SEVERITY_ORDER[s] < SEVERITY_ORDER[acc] ? s : acc), "pass");
    return { id: `branch-${gi}`, label, severity, main, children };
  });

  branches.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    const la = a.main?.lineNo ?? a.children[0]?.lineNo ?? 0;
    const lb = b.main?.lineNo ?? b.children[0]?.lineNo ?? 0;
    return la - lb;
  });

  return { consistency, branches, counts };
}
