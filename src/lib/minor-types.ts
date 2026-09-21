// 경미손상판독기 — 외판 한 부위(또는 여러 부위)의 사진으로 경미손상 유형과 기준상 수리방법을
// 공식 자료(표준약관 별표 2·보험개발원 경미손상 수리기준) 근거로 설명하는 도구. 청구·공정 판단 없음.

export type MinorSide = "좌" | "우" | "중앙";

// 기준 적용대상 9개 부품(범퍼 '16.7.1, 외장 7부품 '19.5.1 책임개시 계약부터)
export const MINOR_PARTS = [
  "앞범퍼",
  "뒤범퍼",
  "후드",
  "프런트펜더",
  "프런트도어",
  "리어도어",
  "리어펜더",
  "트렁크리드",
  "백도어",
] as const;
export type MinorPartName = (typeof MINOR_PARTS)[number];

export interface MinorPartInput {
  part_name: MinorPartName;
  side: MinorSide;
}

export type MinorClass =
  | "1유형"
  | "2유형"
  | "3유형"
  | "기타손상"
  | "손상없음"
  | "판독불가";

export interface MinorPartResult {
  part_name: string;
  side: MinorSide;
  observations: { what: string; location: string; photo_refs: number[] }[];
  classification: MinorClass;
  evidence_confidence: "높음" | "중간" | "낮음";
  key_evidence: string;
  exchange_conditions: {
    condition: string;
    status: "해당" | "해당 없음" | "확인 불가";
    note: string;
  }[];
  repair_method: string;
  additional_photos: string[];
  report_text: string;
  photo_refs: number[];
}

export interface MinorResult {
  vehicle_note: string;
  parts: MinorPartResult[];
}

export interface MinorCaseInfo {
  manufacturer?: string;
  model?: string;
  year?: string;
  plateNo?: string;
  memo?: string;
  parts: MinorPartInput[];
}

export const MINOR_CLASS_LABEL: Record<MinorClass, string> = {
  "1유형": "제1유형 · 투명막 손상",
  "2유형": "제2유형 · 도장막 손상",
  "3유형": "제3유형 · 소재 손상(복원 가능)",
  기타손상: "기타손상 · 교환 대상",
  손상없음: "손상 없음",
  판독불가: "판독 불가",
};
