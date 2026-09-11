import type { AssessmentResult, PartAssessment } from "./assessment-types";
import {
  isMinorDamageType,
  partVerdictLabel,
  type VerdictLabel,
} from "./review-items";
import {
  finalizeBranches,
  makeDiagnostic,
  type AdjustmentDiagnostics,
  type DiagItemView,
  type ItemDiagnostic,
} from "./adjustment-review-items";

// 선견적 결과를 손해사정과 같은 양식(좌: 부위 메인 작업 / 우: 도장·부수·시간 검토)으로.
// 부위별 판정(parts)이 행이 되고, 부수작업 검토는 그 부위의 자식 행, 작업시간 판단과
// 1단계 수리범위 지적은 메인 행 아래 부가 검토로 붙는다.

const FINDING_VERDICT: Record<string, VerdictLabel> = {
  인정가능: "인정",
  협의대상: "협의필요",
  불인정: "불인정",
  확인불가: "조사필요",
};

function partView(part: PartAssessment, lineNo: number): DiagItemView {
  const extras: DiagItemView["extras"] = [];
  const lt = part.labor_time_check;
  if (lt.claimed_h !== null) {
    const ref = lt.reference_h !== null ? ` (참고 ${lt.reference_h}H)` : "";
    const tone =
      lt.general_assessment === "적정"
        ? "ok"
        : lt.general_assessment === "판단 어려움"
          ? "info"
          : "warn";
    const verdictText =
      lt.reference_verdict !== "기준 미제공 - 확인 필요"
        ? lt.reference_verdict
        : lt.general_assessment;
    extras.push({
      tone,
      label: "작업시간",
      text: `청구 ${lt.claimed_h}H${ref} · ${verdictText}${lt.note ? ` — ${lt.note}` : ""}`,
    });
  }
  return {
    roleLabel: part.role ?? "메인",
    lineNo,
    itemName: part.part_name,
    claimedAction: part.claimed_action,
    claimedHours: lt.claimed_h,
    verdict: partVerdictLabel(part),
    followsParent: false,
    reasoning: part.reasoning,
    note: part.verdict === "협의대상" ? part.required_action : "",
    evidenceLabel:
      part.evidence_confidence === "낮음" ? "사진 판독 신뢰도 낮음" : null,
    photoRefs: part.photo_refs ?? [],
    damageType: isMinorDamageType(part.damage_type)
      ? part.damage_type
      : undefined,
    costComparison: null,
    extras,
  };
}

export function buildAssessmentDiagnostics(
  result: AssessmentResult,
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
  const push = (key: string, d: ItemDiagnostic) => {
    const list = byGroup.get(key) ?? [];
    list.push(d);
    byGroup.set(key, list);
  };

  // 1단계 수리범위 지적 → 해당 부위 메인 행의 부가 검토로. 부위를 못 찾으면 별도 브랜치.
  const concerns = result.overall_repair_scope_review.appropriate
    ? []
    : result.overall_repair_scope_review.concerns;
  const concernUsed = new Set<number>();

  result.parts.forEach((part, i) => {
    const view = partView(part, i + 1);
    const key = part.group || part.part_name;
    concerns.forEach((c, ci) => {
      const hit =
        c.item.includes(part.part_name) ||
        part.part_name.includes(c.item) ||
        (part.group ? c.item.includes(part.group) : false);
      if (hit && !concernUsed.has(ci) && (part.role ?? "메인") === "메인") {
        concernUsed.add(ci);
        view.extras.unshift({
          tone: "warn",
          label: "수리범위",
          text: `${c.issue} — ${c.reasoning}`,
        });
      }
    });
    push(key, makeDiagnostic(`part-${i}`, view));

    // 부수작업 검토 → 그 부위의 자식 행
    part.ancillary_work_check.forEach((a, j) => {
      const ok = a.mechanically_plausible && a.in_allowed_list !== false;
      push(
        key,
        makeDiagnostic(`part-${i}-anc-${j}`, {
          roleLabel: "부수",
          lineNo: null,
          itemName: a.item,
          claimedAction: "부수작업",
          claimedHours: null,
          verdict: ok
            ? "인정"
            : a.mechanically_plausible
              ? "협의필요"
              : "불인정",
          followsParent: false,
          reasoning: a.note,
          note: "",
          evidenceLabel: null,
          photoRefs: [],
          costComparison: null,
          extras: [],
        }),
      );
    });
  });

  concerns.forEach((c, ci) => {
    if (concernUsed.has(ci)) return;
    push(
      c.item,
      makeDiagnostic(`concern-${ci}`, {
        roleLabel: "메인",
        lineNo: null,
        itemName: c.item,
        claimedAction: "수리범위 검토",
        claimedHours: null,
        verdict: "협의필요",
        followsParent: false,
        reasoning: `${c.issue} — ${c.reasoning}`,
        note: "",
        evidenceLabel: null,
        photoRefs: c.photo_refs ?? [],
        costComparison: null,
        extras: [],
      }),
    );
  });

  if (
    result.claimed_but_not_visible.length ||
    result.damage_but_not_claimed.length
  ) {
    result.claimed_but_not_visible.forEach((x, i) =>
      push(
        "청구·사진 불일치",
        makeDiagnostic(`cnv-${i}`, {
          roleLabel: "확인",
          lineNo: null,
          itemName: "청구되었으나 사진상 미확인",
          claimedAction: "과잉청구 의심",
          claimedHours: null,
          verdict: "조사필요",
          followsParent: false,
          reasoning: x,
          note: "",
          evidenceLabel: null,
          photoRefs: [],
          costComparison: null,
          extras: [],
        }),
      ),
    );
    result.damage_but_not_claimed.forEach((x, i) =>
      push(
        "청구·사진 불일치",
        makeDiagnostic(`dnc-${i}`, {
          roleLabel: "확인",
          lineNo: null,
          itemName: "사진상 확인되나 청구 누락",
          claimedAction: "누락 가능성",
          claimedHours: null,
          verdict: "조사필요",
          followsParent: false,
          reasoning: x,
          note: "",
          evidenceLabel: null,
          photoRefs: [],
          costComparison: null,
          extras: [],
        }),
      ),
    );
  }

  result.other_findings.forEach((f, i) =>
    push(
      "기타 항목",
      makeDiagnostic(`finding-${i}`, {
        roleLabel: "기타",
        lineNo: null,
        itemName: f.category,
        claimedAction: "기준 검토",
        claimedHours: null,
        verdict: FINDING_VERDICT[f.verdict] ?? "협의필요",
        followsParent: false,
        reasoning: f.description,
        note: "",
        evidenceLabel: f.reference_basis || null,
        photoRefs: [],
        costComparison: null,
        extras: [],
      }),
    ),
  );

  const { branches, counts } = finalizeBranches(byGroup, {
    preserveOrder: true,
  });
  // 메인 없는 브랜치(불일치·기타)는 첫 행을 메인처럼 보이게 하지 않고 자식으로만 둔다 — finalizeBranches가 처리
  if (consistency) counts.warn += 1;
  return { consistency, branches, counts };
}
