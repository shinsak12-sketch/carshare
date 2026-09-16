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
