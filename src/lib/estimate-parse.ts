// 선견적 PDF 원문에서 폼 자동입력에 쓸 정보만 뽑아내는 가벼운 텍스트 전용 GPT 호출.
// 실제 "보험수리비 견적서(AUTOMOBILE REPAIR COST On-line)" 양식에는 접수번호는
// 항상 있지만 차량 제조사/모델/연식은 아예 없는 경우가 많음 — 없으면 null로
// 두게 하고, 폼에서는 계속 수동 입력 가능하게 둠(추측해서 지어내면 더 위험함).

export const ESTIMATE_PARSE_PROMPT = `당신은 자동차 정비 견적서 원문에서 정해진 필드만 추출하는 도우미입니다.
아래 규칙을 반드시 지키십시오.
1. 견적서에 명시적으로 적힌 값만 추출하십시오. 부품코드나 작업내역으로부터
   차종을 추측하지 마십시오.
2. 값을 찾을 수 없으면 반드시 null로 두십시오. 특히 "보험수리비 견적서" 양식은
   접수번호/사고일자/업체명은 있지만 차량 제조사·모델·연식은 아예 인쇄되지
   않는 경우가 많습니다 — 이 경우 manufacturer/model/year는 모두 null입니다.
3. claimNumber는 "접수번호" 라벨 옆의 숫자를 그대로 문자열로 추출하십시오.
4. year는 4자리 연도 숫자만 추출하십시오(예: "2022년식" → 2022). 사고일자나
   접수일자의 연도를 차량 연식으로 혼동하지 마십시오.
`;

export const ESTIMATE_PARSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    claimNumber: { type: ["string", "null"] },
    manufacturer: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    year: { type: ["number", "null"] },
  },
  required: ["claimNumber", "manufacturer", "model", "year"],
} as const;

export interface ParsedEstimateInfo {
  claimNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
}
