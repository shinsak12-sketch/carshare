// [실험] 청구 견적서 항목 표(EstimateRow[])를 화면용으로 — 분류·묶기 없이 견적서 순서 그대로.
// 구분(부품/공임/도장)만 배지로 붙인다.
import type { EstimateRow } from "./estimate-table";

export type EstimateLineKind = "부품" | "공임" | "도장" | "기타";

export interface EstimateLine {
  line_no: string;
  kind: EstimateLineKind;
  name: string;
  action: string;
  hours: number | null;
  qty: number | null;
  partCode: string;
  // 순번에 U가 붙은 행 = AOS 표준 항목이 아닌 공업사 직접 입력(사용자공임·사용자부품)
  userDefined?: boolean;
  before: { part: number | null; labor: number | null };
  after: { part: number | null; labor: number | null };
}

export interface EstimateTree {
  rows: EstimateLine[];
  rowCount: number;
}

export function buildEstimateTree(rows: EstimateRow[]): EstimateTree {
  const lines: EstimateLine[] = rows.map((r) => {
    const isPart =
      r.action === "" && (r.partCode !== "" || (r.before.part ?? 0) > 0);
    const isPaint = r.action === "도장" || r.action.endsWith("도장");
    const kind: EstimateLineKind = isPart
      ? "부품"
      : isPaint
        ? "도장"
        : r.action
          ? "공임"
          : "기타";
    return {
      line_no: r.no,
      kind,
      name: r.name,
      action: r.action,
      hours: kind === "부품" ? null : r.hq,
      qty: kind === "부품" ? r.hq : null,
      partCode: r.partCode,
      userDefined: /^U/i.test(r.no),
      before: r.before,
      after: r.after,
    };
  });
  return { rows: lines, rowCount: lines.length };
}

// 캐시에 남은 옛 형식(그룹 트리)이나 깨진 값이면 null — 화면이 죽지 않게
export function isEstimateTree(v: unknown): v is EstimateTree {
  if (!v || typeof v !== "object") return false;
  const t = v as { rows?: unknown };
  return (
    Array.isArray(t.rows) &&
    t.rows.every(
      (r) => r && typeof r === "object" && "before" in r && "after" in r,
    )
  );
}

// [실험] GPT에 넘길 항목표 텍스트. 원문 텍스트는 열이 뒤섞여 항목 순번을 세기 어려우니
// 좌표로 읽은 표를 "NO | 구분 | 작업 | 항목명 | 시간 | 청구 공임 | 청구 부품·재료" 로 정리해
// line_no가 견적서 NO와 1:1로 맞게 한다. NO의 U 접두(U12)는 떼고 숫자만.
export function formatEstimateTableForPrompt(tree: EstimateTree): string {
  const won = (n: number | null) => (n == null ? "-" : String(n));
  const lines = tree.rows.map((r) => {
    const no = String(r.line_no).replace(/^U/i, "");
    const hq =
      r.kind === "부품"
        ? r.qty != null && r.qty !== 1
          ? `×${r.qty}`
          : "-"
        : r.hours != null
          ? `${r.hours}H`
          : "-";
    const kind = r.userDefined ? `사용자${r.kind}` : r.kind;
    return `${no} | ${kind} | ${r.action || "-"} | ${r.name} | ${hq} | 공임 ${won(r.before.labor)} | 부품·재료 ${won(r.before.part)}`;
  });
  return [
    "NO | 구분 | 작업 | 항목명 | 시간/수량 | 청구 공임 | 청구 부품·재료",
    "(구분이 사용자공임·사용자부품이면 AOS 표준 항목이 아닌 공업사 직접 입력 값)",
    ...lines,
  ].join("\n");
}
