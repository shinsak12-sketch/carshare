import type { DamagedPartSummary, ProcedureResult, SuspectedHiddenDamage } from "./procedure-types";
import { isMinorDamageType } from "./review-items";

// 정비공정 도구는 청구 타당성을 다투는 게 아니라 "무슨 작업이 필요한가"를
// 미리 판단하는 도구라, 선견적진단의 인정/불인정 같은 판정 배지가 그대로
// 맞지 않음. 그래서 이 도구 성격에 맞는 배지 어휘를 따로 둠 — 색 언어
// (초록/파랑/빨강/주황)는 선견적진단과 통일해 같은 화면처럼 보이게 함.
export type ProcedureBadge = "손상없음" | "손상확인" | "의심도 높음" | "의심도 중간" | "의심도 낮음" | "확인필요";

export const PROCEDURE_BADGE_STYLES: Record<ProcedureBadge, { bar: string; badge: string }> = {
  손상없음: { bar: "bg-emerald-500", badge: "bg-emerald-600" },
  손상확인: { bar: "bg-sky-500", badge: "bg-sky-600" },
  "의심도 높음": { bar: "bg-red-500", badge: "bg-red-600" },
  "의심도 중간": { bar: "bg-amber-500", badge: "bg-amber-500" },
  "의심도 낮음": { bar: "bg-slate-300", badge: "bg-slate-400" },
  확인필요: { bar: "bg-red-500", badge: "bg-red-600" },
};

export type ProcedureReviewItem =
  | { id: string; kind: "consistency"; badge: ProcedureBadge; title: string; section: string; warning: string }
  | {
      id: string;
      kind: "part";
      badge: ProcedureBadge;
      damageType?: string;
      title: string;
      section: string;
      part: DamagedPartSummary;
    }
  | {
      id: string;
      kind: "hidden";
      badge: ProcedureBadge;
      title: string;
      section: string;
      hidden: SuspectedHiddenDamage;
    };

function withSide(name: string, side: string): string {
  return side !== "중앙" ? `${name}(${side})` : name;
}

export function buildProcedureReviewItems(result: ProcedureResult): ProcedureReviewItem[] {
  const items: ProcedureReviewItem[] = [];

  if (!result.physical_consistency.consistent) {
    items.push({
      id: "consistency",
      kind: "consistency",
      badge: "확인필요",
      title: "사고 정합성 경고",
      section: "정합성",
      warning: result.physical_consistency.warning,
    });
  }

  result.damaged_parts.forEach((part, i) => {
    const noDamage = part.damage_type === "손상없음";
    items.push({
      id: `part-${i}`,
      kind: "part",
      badge: noDamage ? "손상없음" : "손상확인",
      damageType: isMinorDamageType(part.damage_type) ? part.damage_type : undefined,
      title: withSide(part.part_name, part.side),
      section: "손상 부위",
      part,
    });
  });

  result.suspected_hidden_damage.forEach((hidden, i) => {
    items.push({
      id: `hidden-${i}`,
      kind: "hidden",
      badge: `의심도 ${hidden.suspicion_level}` as ProcedureBadge,
      title: withSide(hidden.item, hidden.side),
      section: "정밀점검 필요 — 추정 손상",
      hidden,
    });
  });

  return items;
}
