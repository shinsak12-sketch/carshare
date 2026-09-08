// 선견적 PDF에서 뽑은 원문 텍스트를 AI(OpenAI)로 보내기 전에 개인정보를
// 지우는 용도. 견적서 양식에는 고객명/연락처/주소/차량번호 등이 찍혀
// 나오는 경우가 많은데, 손상·작업범위 판단에는 전혀 필요 없는 정보라
// 아예 외부로 나가지 않게 막음.

const LABEL_PATTERNS = [
  "고객명",
  "성명",
  "차주명",
  "차주",
  "계약자명",
  "보험계약자",
  "피보험자",
  "연락처",
  "전화번호",
  "휴대폰번호",
  "휴대폰",
  "휴대전화",
  "이메일",
  "e-mail",
  "email",
  "주소",
  "생년월일",
  "주민등록번호",
  "주민번호",
  "차량번호",
  "차량등록번호",
  "차대번호",
];

const REDACTED = "[개인정보 비공개]";

export function redactPersonalInfo(text: string): string {
  let result = text;

  // 라벨(고객명: / 연락처: 등) 뒤에 오는 값을 한 줄 단위로 지움 —
  // 값이 라벨과 같은 줄에 없는 경우도 있어 완벽하진 않지만, 노출보단
  // 과잉 삭제가 안전하다는 원칙으로 접근.
  for (const label of LABEL_PATTERNS) {
    const re = new RegExp(`(${label}\\s*[:：]?\\s*)([^\\n]*)`, "gi");
    result = result.replace(re, (_match, prefix: string) => `${prefix}${REDACTED}`);
  }

  // 라벨 없이 본문에 그대로 섞여 나오는 형식들도 패턴으로 한 번 더 제거.
  result = result
    .replace(/\d{6}\s?-\s?[1-4]\d{6}/g, REDACTED) // 주민등록번호
    .replace(/01[016789]-?\d{3,4}-?\d{4}/g, REDACTED) // 휴대전화
    .replace(/0(2|[3-6][1-5])-?\d{3,4}-?\d{4}/g, REDACTED) // 지역번호 유선전화
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, REDACTED); // 이메일

  return result;
}
