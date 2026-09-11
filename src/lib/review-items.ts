import type {
  AssessmentResult,
  DamageType,
  OtherFindingVerdict,
  PartAssessment,
} from "./assessment-types";

// 목록/상세 화면에서 공통으로 쓰는 판정 배지. 회사 참고자료 판정(적정/과다/과소)과는
// 별개로, 담당자가 목록만 보고도 "이건 정상/이건 과다청구/이건 그냥 확인만
// 필요"를 바로 구분할 수 있게 5개로 단순화한 것.
export type VerdictLabel =
  | "인정"
  | "협의필요"
  | "과다청구"
  | "조사필요"
  | "불인정";

export const VERDICT_ORDER: VerdictLabel[] = [
  "불인정",
  "과다청구",
  "협의필요",
  "조사필요",
  "인정",
];

export const VERDICT_STYLES: Record<
  VerdictLabel,
  { bar: string; badge: string }
> = {
  인정: { bar: "bg-emerald-500", badge: "bg-emerald-600" },
  협의필요: { bar: "bg-amber-500", badge: "bg-amber-500" },
  과다청구: { bar: "bg-orange-500", badge: "bg-orange-600" },
  조사필요: { bar: "bg-sky-500", badge: "bg-sky-600" },
  불인정: { bar: "bg-red-500", badge: "bg-red-600" },
};

// 경미손상 유형(1~3유형 등)은 "판정"이 아니라 "분류"라서 색이 있는 판정
// 배지와 헷갈리지 않도록 항상 중립적인(흰 바탕 테두리) 스타일로 표시.
export const TYPE_BADGE_CLASS =
  "rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600";

// 경미손상 1~3유형은 외판부품(범퍼·펜더·도어 등)에만 의미가 있는 분류라,
// "비대상(교환예외)"·"손상없음" 같은 값까지 배지로 노출하면 오히려
// 판정 배지와 헷갈림 — 실제 1~3유형일 때만 유형 배지를 붙임.
export function isMinorDamageType(
  t?: DamageType,
): t is "1유형" | "2유형" | "3유형" {
  return t === "1유형" || t === "2유형" || t === "3유형";
}

export function partVerdictLabel(part: PartAssessment): VerdictLabel {
  if (part.verdict === "인정가능") return "인정";
  if (part.verdict === "불인정") return "불인정";

  // 협의대상: 작업시간이 과다 의심(회사기준 또는 정비지식 기준)이면 "과다청구"로
  // 더 구체적으로 표시하고, 사진 판독 신뢰도가 낮아서 협의대상이 된 경우는
  // "조사필요"(추가 확인 필요)로 구분. 둘 다 아니면 일반 "협의필요".
  const lt = part.labor_time_check;
  if (
    lt.claimed_h !== null &&
    (lt.general_assessment === "과다 의심" || lt.reference_verdict === "과다")
  ) {
    return "과다청구";
  }
  if (part.evidence_confidence === "낮음") return "조사필요";
  return "협의필요";
}

const findingVerdictLabel: Record<OtherFindingVerdict, VerdictLabel> = {
  인정가능: "인정",
  협의대상: "협의필요",
  불인정: "불인정",
  확인불가: "조사필요",
};

export type ReviewItem = { photoRefs: number[] } & (
  | {
      id: string;
      kind: "consistency";
      verdict: VerdictLabel;
      title: string;
      section: string;
      warning: string;
    }
  | {
      id: string;
      kind: "concern-ok";
      verdict: VerdictLabel;
      title: string;
      section: string;
    }
  | {
      id: string;
      kind: "concern";
      verdict: VerdictLabel;
      damageType?: DamageType;
      title: string;
      section: string;
      item: string;
      issue: string;
      reasoning: string;
    }
  | {
      id: string;
      kind: "part";
      verdict: VerdictLabel;
      damageType: DamageType;
      title: string;
      section: string;
      part: PartAssessment;
    }
  | {
      id: string;
      kind: "mismatch";
      verdict: VerdictLabel;
      title: string;
      section: string;
      visible: string[];
      claimed: string[];
    }
  | {
      id: string;
      kind: "finding";
      verdict: VerdictLabel;
      title: string;
      section: string;
      description: string;
      referenceBasis: string;
    }
);

export const SECTION_LABELS = {
  consistency: "정합성",
  scope: "1단계 · 전체 수리범위",
  parts: "2단계 · 부위별 판정",
  mismatch: "확인사항",
  findings: "기타 항목",
} as const;

export function buildReviewItems(result: AssessmentResult): ReviewItem[] {
  const items: ReviewItem[] = [];

  if (!result.physical_consistency.consistent) {
    items.push({
      id: "consistency",
      kind: "consistency",
      verdict: "조사필요",
      title: "사고 정합성 경고",
      section: SECTION_LABELS.consistency,
      warning: result.physical_consistency.warning,
      photoRefs: [],
    });
  }

  if (result.overall_repair_scope_review.appropriate) {
    items.push({
      id: "scope-ok",
      kind: "concern-ok",
      verdict: "인정",
      title: "전체 수리범위 적정",
      section: SECTION_LABELS.scope,
      photoRefs: [],
    });
  } else {
    result.overall_repair_scope_review.concerns.forEach((c, i) => {
      // 관련 부위를 찾아서 그 부위의 실제 판정/유형을 그대로 물려받게 함 —
      // "전체범위"라는 두루뭉술한 라벨 대신 실제로 뭐가 문제인지 배지로 바로 보이게.
      const matched = result.parts.find(
        (p) => c.item.includes(p.part_name) || p.part_name.includes(c.item),
      );
      items.push({
        id: `concern-${i}`,
        kind: "concern",
        verdict: matched ? partVerdictLabel(matched) : "협의필요",
        damageType: matched?.damage_type,
        title: c.item,
        section: SECTION_LABELS.scope,
        item: c.item,
        issue: c.issue,
        reasoning: c.reasoning,
        photoRefs: c.photo_refs ?? matched?.photo_refs ?? [],
      });
    });
  }

  result.parts.forEach((part, i) => {
    items.push({
      id: `part-${i}`,
      kind: "part",
      verdict: partVerdictLabel(part),
      damageType: part.damage_type,
      title: `${i + 1}. ${part.part_name}`,
      section: SECTION_LABELS.parts,
      part,
      photoRefs: part.photo_refs ?? [],
    });
  });

  if (
    result.claimed_but_not_visible.length > 0 ||
    result.damage_but_not_claimed.length > 0
  ) {
    items.push({
      id: "mismatch",
      kind: "mismatch",
      verdict: "조사필요",
      title: "청구·사진 불일치",
      section: SECTION_LABELS.mismatch,
      visible: result.claimed_but_not_visible,
      claimed: result.damage_but_not_claimed,
      photoRefs: [],
    });
  }

  result.other_findings.forEach((f, i) => {
    items.push({
      id: `finding-${i}`,
      kind: "finding",
      verdict: findingVerdictLabel[f.verdict],
      title: f.category,
      section: SECTION_LABELS.findings,
      description: f.description,
      referenceBasis: f.reference_basis,
      photoRefs: [],
    });
  });

  return items;
}
