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
export function buildReportText(caseInfo: ReportCaseInfo, result: AssessmentResult): string {
  const vehicleLine = `차량: ${caseInfo.manufacturer} ${caseInfo.model}${
    caseInfo.year ? ` ${caseInfo.year}년식` : ""
  } | 손상부위: ${caseInfo.damagedPart || "미기재"}${
    caseInfo.createdAt ? ` | 진단일시: ${caseInfo.createdAt.toLocaleString("ko-KR")}` : ""
  }`;

  const lines: string[] = ["손해사정 검토 결과 (AI 초안)", "", vehicleLine, ""];

  result.parts.forEach((part, i) => {
    lines.push(`${i + 1}. ${part.part_name} (청구: ${part.claimed_action})`);
    lines.push(part.reasoning);
    const verdictLine =
      part.verdict === "협의대상" && part.required_action
        ? `→ 판정: ${part.damage_type} · 협의대상 — ${part.required_action}`
        : `→ 판정: ${part.damage_type} · ${part.verdict}`;
    lines.push(verdictLine);
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
