import { wireKeyLegend } from "./wire-keys";

// 관리자가 고르는 출력 상세도. 판단 절차·판정은 동일하고 문장 길이만 다르다.
export type OutputDetail = "detailed" | "brief";

export const OUTPUT_DETAIL_LABEL: Record<OutputDetail, string> = {
  detailed: "상세",
  brief: "간략",
};

export function isOutputDetail(v: unknown): v is OutputDetail {
  return v === "detailed" || v === "brief";
}

// 간략 모드 블록. 세 도구 공통(해당 없는 필드는 무시됨).
export const BRIEF_OUTPUT_BLOCK = `# 출력 간략 모드
판단 절차·판정(verdict)·항목 수·line_no·photo_refs·judgment_basis·photo_evidence·
damage_type·시간 판단은 상세 모드와 완전히 같게 수행하고, 문장만 줄입니다.
판정을 바꾸거나 항목을 생략하는 근거로 쓰지 마십시오. 이 도구에 없는 필드는
무시합니다.
- reasoning: 핵심 근거 한 구절, 구절체 허용. 인정(인정가능) 항목은 15자 내외
  (예: "작업사진 확인", "펜더 교환에 수반", "긁힘뿐 균열 없음"), 그 외 항목은
  "보이는 것 → 결론"을 한 문장 이내로. 예외: 판금·복원수리 시간을 판단한
  항목은 [판금·수리 시간 판단]의 판독 축 한 줄을 유지합니다(시간 판단 근거).
  "실시 여부는 손해사정 시 확인", "품질인증부품 가능" 같은 덧붙임 구절은 유지.
- adjustment_note / note / required_action / recommended_check: 조정·조치
  결론만 한 구절(예: "교환공임·교환도장 불인정, 보수도장 Lv1").
- cost_comparison: 금액 식과 결론 한 구절만.
- concerns.reasoning, other_findings.description, suspected_hidden_damage.reasoning,
  step detail: 한 문장 이내.
- overall_opinion: 공업사 발신 어투와 번호 형식은 그대로 두고 항목당 한 문장.
  overall_summary: 두 문장(공정 요약 + 숨은 손상·사전판단 취지). warning: 한 문장.
- 정식 문어체(합니다체) 요구는 overall_opinion·overall_summary를 제외하고
  해제합니다.`;

// 도구 route가 OpenAI에 보낼 최종 system 텍스트
export function buildSystemPrompt(
  base: string,
  schema: unknown,
  detail: OutputDetail,
): string {
  const parts = [base, wireKeyLegend(schema)];
  if (detail === "brief") parts.push(BRIEF_OUTPUT_BLOCK);
  return parts.filter(Boolean).join("\n\n");
}

export function taggedPromptVersion(tag: string, detail: OutputDetail) {
  return detail === "brief" ? `${tag}-brief` : tag;
}
