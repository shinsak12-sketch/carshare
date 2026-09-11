import type {
  AdjustmentItem,
  AdjustmentResult,
  CostComparison,
  ItemRole,
} from "./adjustment-types";
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

// 화면·복사 텍스트가 공통으로 읽는 행 뷰 — 손해사정(청구서 항목)과 선견적(부위별 판정)이
// 같은 양식(좌: 메인 작업 / 우: 그 부위의 도장·부수·시간 검토)으로 보이게 하기 위한 추상화.
export interface DiagItemView {
  roleLabel: ItemRole | string;
  lineNo: number | null;
  itemName: string;
  claimedAction: string;
  claimedHours: number | null;
  verdict: VerdictLabel;
  followsParent: boolean;
  reasoning: string;
  note: string;
  evidenceLabel: string | null;
  photoRefs: number[];
  damageType?: string;
  costComparison: CostComparison | null;
  // 행 아래 붙는 부가 검토(작업시간 판단, 수리범위 지적 등)
  extras: { tone: "ok" | "warn" | "info"; label: string; text: string }[];
}

export interface ItemDiagnostic {
  id: string;
  severity: DiagnosticSeverity;
  verdict: VerdictLabel;
  lineNo: number | null;
  damageType?: string;
  view: DiagItemView;
}

// 브랜치 = 메인 부품/부위 단위. 메인 행 + 도장/부수 자식 행.
// 집계(✖/⚠/✔ 건수)는 독립 판정(followsParent=false)만 센다.
export interface DiagnosticBranch {
  id: string;
  label: string;
  severity: DiagnosticSeverity;
  main: ItemDiagnostic | null;
  children: ItemDiagnostic[];
}

export interface AdjustmentDiagnostics {
  consistency: {
    severity: "warn";
    verdict: VerdictLabel;
    title: string;
    message: string;
  } | null;
  branches: DiagnosticBranch[];
  counts: Record<DiagnosticSeverity, number>;
}

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = {
  error: 0,
  warn: 1,
  pass: 2,
};
const ROLE_ORDER: Record<string, number> = { 메인: 0, 도장: 1, 부수: 2 };

export function makeDiagnostic(id: string, view: DiagItemView): ItemDiagnostic {
  return {
    id,
    severity: severityOf(view.verdict),
    verdict: view.verdict,
    lineNo: view.lineNo,
    damageType: view.damageType,
    view,
  };
}

// 그룹별 행 목록 → 브랜치(메인 + 자식) 정렬·심각도·집계까지. 두 도구가 공유.
export function finalizeBranches(
  byGroup: Map<string, ItemDiagnostic[]>,
  opts?: { preserveOrder?: boolean },
): {
  branches: DiagnosticBranch[];
  counts: Record<DiagnosticSeverity, number>;
} {
  const counts: Record<DiagnosticSeverity, number> = {
    error: 0,
    warn: 0,
    pass: 0,
  };
  for (const list of byGroup.values())
    for (const d of list) if (!d.view.followsParent) counts[d.severity] += 1;

  const branches: DiagnosticBranch[] = [...byGroup.entries()].map(
    ([label, list], gi) => {
      if (!opts?.preserveOrder) {
        list.sort(
          (a, b) =>
            (ROLE_ORDER[a.view.roleLabel] ?? 9) -
              (ROLE_ORDER[b.view.roleLabel] ?? 9) ||
            (a.lineNo ?? 0) - (b.lineNo ?? 0),
        );
      }
      const mainIdx = list.findIndex((d) => d.view.roleLabel === "메인");
      const main = mainIdx >= 0 ? list[mainIdx] : null;
      const children = list.filter((_, idx) => idx !== mainIdx);
      const independent = list.filter((d) => !d.view.followsParent);
      const severity = (independent.length ? independent : list)
        .map((d) => d.severity)
        .reduce<DiagnosticSeverity>(
          (acc, s) => (SEVERITY_ORDER[s] < SEVERITY_ORDER[acc] ? s : acc),
          "pass",
        );
      return { id: `branch-${gi}`, label, severity, main, children };
    },
  );

  branches.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    const la = a.main?.lineNo ?? a.children[0]?.lineNo ?? 0;
    const lb = b.main?.lineNo ?? b.children[0]?.lineNo ?? 0;
    return la - lb;
  });

  return { branches, counts };
}

function toView(item: AdjustmentItem): DiagItemView {
  return {
    roleLabel: item.role,
    lineNo: item.line_no,
    itemName: item.item_name,
    claimedAction: item.claimed_action,
    claimedHours: item.claimed_hours,
    verdict: item.verdict,
    followsParent: item.follows_parent,
    reasoning: item.reasoning,
    note: item.adjustment_note,
    evidenceLabel: item.photo_evidence,
    photoRefs: item.photo_refs,
    damageType: isMinorDamageType(item.damage_type ?? undefined)
      ? (item.damage_type ?? undefined)
      : undefined,
    costComparison: item.cost_comparison ?? null,
    extras: [],
  };
}

export function buildAdjustmentDiagnostics(
  result: AdjustmentResult,
): AdjustmentDiagnostics {
  const consistency = result.physical_consistency.consistent
    ? null
    : {
        severity: "warn" as const,
        verdict: "조사필요" as VerdictLabel,
        title: "사고 정합성 / 차량 동일성 경고",
        message: result.physical_consistency.warning,
      };

  const byGroup = new Map<string, ItemDiagnostic[]>();
  result.items.forEach((item, i) => {
    const d = makeDiagnostic(`item-${i}`, toView(item));
    const key = item.group || item.item_name;
    const list = byGroup.get(key) ?? [];
    list.push(d);
    byGroup.set(key, list);
  });

  const { branches, counts } = finalizeBranches(byGroup);
  if (consistency) counts.warn += 1;
  return { consistency, branches, counts };
}
