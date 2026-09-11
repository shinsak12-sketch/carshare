// 선견적 PDF 원문에서 폼 자동입력에 쓸 정보만 뽑아내는 가벼운 텍스트 전용 GPT 호출.
// 실제 "보험수리비 견적서(AUTOMOBILE REPAIR COST On-line)" 양식에는 차량
// 제조사/모델/연식이 아예 인쇄되지 않는 경우가 많음 — 없으면 null로 두게 하고,
// 폼에서는 계속 수동 입력 가능하게 둠(추측해서 지어내면 더 위험함).

export const ESTIMATE_PARSE_PROMPT = `당신은 자동차 정비 견적서 원문에서 정해진 필드만 추출하는 도우미입니다.
아래 규칙을 반드시 지키십시오.
1. 견적서에 명시적으로 적힌 값만 추출하십시오. 부품코드나 작업내역으로부터
   차종을 추측하지 마십시오.
2. 값을 찾을 수 없으면 반드시 null로 두십시오. 특히 "보험수리비 견적서" 양식은
   차량 제조사·모델·연식이 아예 인쇄되지 않는 경우가 많습니다.
3. year는 4자리 연도 숫자만 추출하십시오(예: "2022년식" → 2022). 사고일자나
   접수일자의 연도를 차량 연식으로 혼동하지 마십시오.
`;

export const ESTIMATE_PARSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    manufacturer: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    year: { type: ["number", "null"] },
  },
  required: ["manufacturer", "model", "year"],
} as const;

export interface ParsedEstimateInfo {
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  // 차량번호는 외부 AI에 보내지 않고 서버에서 정규식으로만 뽑음(탭 이름용, 브라우저에만 저장)
  plateNumber: string | null;
}

const REGION = "(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)";
const PLATE_RE = new RegExp(`(?:${REGION}\\s?)?\\d{2,3}\\s?[가-힣]\\s?\\d{4}`, "g");
// 번호판 가운데 글자로 실제 쓰이는 용도기호만 허용 — "12월 3456" 같은 오탐 방지
const PLATE_MID = /^[가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호구누두루무부수우주추쿠투푸후배]$/;

export function extractPlateNumber(text: string): string | null {
  const matches = text.match(PLATE_RE);
  if (!matches) return null;
  for (const raw of matches) {
    const compact = raw.replace(/\s+/g, "");
    const mid = compact.replace(new RegExp(`^${REGION}`), "").replace(/\d/g, "");
    if (PLATE_MID.test(mid)) return compact;
  }
  return null;
}
