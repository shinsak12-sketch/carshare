import type { AssessmentResult } from "./assessment-types";

export interface ReportCaseInfo {
  manufacturer: string;
  model: string;
  year?: number | null;
  damagedPart?: string | null;
  createdAt?: Date;
}

// 화면에 보여주는 것과 "복사" 버튼으로 복사되는 텍스트가 항상 같은 내용을
// 갖도록, 렌더링과 복사 양쪽에서 이 함수 하나로 텍스트를 만든다.
// 사람이 입력한 손상부위 대신, AI가 실제로 판정한 부위 목록을 보여줌
// (신고 내용을 그대로 되돌려주는 게 아니라 AI가 인식한 결과가 맞아야 함).
export function derivedDamagedParts(result: AssessmentResult, fallback?: string | null): string {
  const parts = result.parts.map((p) => p.part_name);
  return parts.length > 0 ? parts.join(", ") : fallback || "미기재";
}

export function buildReportText(caseInfo: ReportCaseInfo, result: AssessmentResult): string {
  const vehicleLine = `차량: ${caseInfo.manufacturer} ${caseInfo.model}${
    caseInfo.year ? ` ${caseInfo.year}년식` : ""
  } | 손상부위: ${derivedDamagedParts(result, caseInfo.damagedPart)}${
    caseInfo.createdAt ? ` | 진단일시: ${caseInfo.createdAt.toLocaleString("ko-KR")}` : ""
  }`;

  const lines: string[] = ["손해사정 검토 결과 (AI 초안)", "", vehicleLine, ""];

  if (!result.physical_consistency.consistent) {
    lines.push(`⚠ 사고 정합성 경고: ${result.physical_consistency.warning}`);
    lines.push("");
  }

  lines.push("[1단계] 전체 수리범위 적정성 검토");
  if (result.overall_repair_scope_review.appropriate) {
    lines.push("전체 청구 범위는 손상 정도에 비해 적정한 것으로 판단됩니다.");
  } else {
    for (const c of result.overall_repair_scope_review.concerns) {
      lines.push(`- ${c.item}: ${c.issue} — ${c.reasoning}`);
    }
  }
  lines.push("");
  lines.push("[2단계] 부위별 작업 정도 판정");
  lines.push("");

  result.parts.forEach((part, i) => {
    lines.push(`${i + 1}. ${part.part_name} (청구: ${part.claimed_action})`);
    lines.push(part.reasoning);
    const verdictLine =
      part.verdict === "협의대상" && part.required_action
        ? `→ 판정: ${part.damage_type} · 협의대상 — ${part.required_action}`
        : `→ 판정: ${part.damage_type} · ${part.verdict}`;
    lines.push(verdictLine);

    if (part.labor_time_check.claimed_h !== null) {
      const ref =
        part.labor_time_check.reference_h !== null ? ` (참고 ${part.labor_time_check.reference_h}H)` : "";
      lines.push(
        `  작업시간: 청구 ${part.labor_time_check.claimed_h}H${ref} — ${part.labor_time_check.note}`
      );
    }
    if (part.ancillary_work_check.length > 0) {
      lines.push("  부수작업:");
      for (const a of part.ancillary_work_check) {
        lines.push(`  · ${a.item}: ${a.note}`);
      }
    }
    lines.push("");
  });

  if (result.claimed_but_not_visible.length > 0 || result.damage_but_not_claimed.length > 0) {
    lines.push("[청구·사진 불일치 확인사항]");
    for (const x of result.claimed_but_not_visible) {
      lines.push(`- 청구되었으나 사진상 미확인(과잉청구 의심): ${x}`);
    }
    for (const x of result.damage_but_not_claimed) {
      lines.push(`- 사진상 확인되나 청구 누락 가능성: ${x}`);
    }
    lines.push("");
  }

  if (result.other_findings.length > 0) {
    lines.push("[기타 항목 검토]");
    for (const f of result.other_findings) {
      lines.push(`- ${f.category}: ${f.description} (${f.reference_basis}) → ${f.verdict}`);
    }
    lines.push("");
  }

  lines.push("종합 의견");
  lines.push(result.overall_opinion);

  if (result.disputed_items.length > 0) {
    lines.push("");
    lines.push(`협의 필요 항목: ${result.disputed_items.join(", ")}`);
  }

  if (!result.estimate_provided) {
    lines.push("");
    lines.push(
      "※ 선견적 데이터가 제공되지 않아 사진 기반 손상유형 판독만 제공되었으며, 청구 타당성은 별도 확인이 필요합니다."
    );
  }

  return lines.join("\n");
}
