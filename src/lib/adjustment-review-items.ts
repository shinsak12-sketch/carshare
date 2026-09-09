import type { AdjustmentItem, AdjustmentResult } from "./adjustment-types";
import { isMinorDamageType, type VerdictLabel } from "./review-items";

export type AdjustmentReviewItem =
  | { id: string; kind: "consistency"; verdict: VerdictLabel; title: string; section: string; warning: string }
  | {
      id: string;
      kind: "item";
      verdict: VerdictLabel;
      damageType?: string;
      title: string;
      section: string;
      item: AdjustmentItem;
    };

export function buildAdjustmentReviewItems(result: AdjustmentResult): AdjustmentReviewItem[] {
  const items: AdjustmentReviewItem[] = [];

  if (!result.physical_consistency.consistent) {
    items.push({
      id: "consistency",
      kind: "consistency",
      verdict: "조사필요",
      title: "사고 정합성 경고",
      section: "정합성",
      warning: result.physical_consistency.warning,
    });
  }

  result.items.forEach((item, i) => {
    items.push({
      id: `item-${i}`,
      kind: "item",
      verdict: item.verdict,
      damageType: isMinorDamageType(item.damage_type ?? undefined) ? item.damage_type ?? undefined : undefined,
      title: item.item_name,
      section: "청구 항목",
      item,
    });
  });

  return items;
}
