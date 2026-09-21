import type { DamageType, PhysicalConsistency } from "./assessment-types";
import type { VerdictLabel } from "./review-items";

// 선견적진단의 판정 배지(인정/협의필요/과다청구/조사필요/불인정)와 의미가
// 그대로 같아서 타입을 재사용함 — UI 색상도 자동으로 통일됨.
export type AdjustmentVerdict = VerdictLabel;

export type PhotoEvidence = "직접확인" | "간접확인" | "확인불가";
// 필요성 판단의 근거 — 직접확인(파손 사진·청구서 구조로 확인) / 추론(충격 경로로 추론).
// 담당자가 추론 항목만 따로 검토할 수 있게 화면·복사 텍스트에 구분 표시함.
export type JudgmentBasis = "직접확인" | "추론";

// 청구 항목의 역할 — 메인(공임의 핵심 작업) / 도장 / 부수(탈착·O/H 등).
// 부품비 라인은 판단 대상이 아님(공임 판정 보고 담당자가 AOS에서 처리).
export type ItemRole = "메인" | "도장" | "부수";

export interface AdjustmentItem {
  // 견적서 원문의 항목 순번 — 린터의 "몇 번째 줄"처럼 문제 항목을 바로 찾게 함.
  line_no: number;
  // 브랜치(카테고리) 이름 — 메인 부품/부위 기준. 예: "리어범퍼", "프런트펜더(좌)"
  group: string;
  role: ItemRole;
  // 같은 group의 메인 항목 line_no. 메인이면 null.
  // 이 항목의 판정이 메인 항목 판정의 결과로 따라온 것(연동)이면 true —
  // 화면·집계에서 독립 판정으로 세지 않음.
  follows_parent: boolean;
  item_name: string;
  claimed_action: string;
  // 판금·수리로 청구된 항목만 견적서상 청구 시간(시간 단위)을 채움 —
  // 시간 과다 여부 판단(사진 속 손상 난이도 대비)에 씀. 그 외 항목은 null.
  claimed_hours: number | null;
  photo_evidence: PhotoEvidence;
  // 예전 결과(adj3.0 이전)에는 없어서 optional
  judgment_basis?: JudgmentBasis;
  // 판단 근거가 된 사진 번호(1부터). 화면에서 해당 사진을 강조하는 데 씀.
  photo_refs: number[];
  // 경미손상 적용대상 부품이고 수리 전 손상 상태가 사진에서 확인될 때만 채움.
  damage_type: DamageType | null;
  verdict: AdjustmentVerdict;
  reasoning: string;
  adjustment_note: string;
  // adj4.1부터 출력하지 않음(금액 비교가 정확하지 않아 제거). 예전 결과 표시용으로만 남김.
  cost_comparison?: CostComparison | null;
}

export interface CostComparison {
  replace_option: string;
  repair_option: string;
  recommendation: string;
}

// 1단계(정비사) 결과 — 수리 계획. adj4.0부터. 예전 결과에는 없음.
export interface RepairPlan {
  vehicle_structure: string; // 예: "캡오버 트럭(봉고3)"
  damage_summary: string;
  main_works: {
    part_name: string;
    work: string; // 교환/판금/절단 접합/도장 등 청구된 대로
    judgment_basis: JudgmentBasis;
    reasoning: string;
  }[];
  // 메인 작업을 하기 위한 접근·분해 경로(파손 여부와 무관)
  access_path: { item: string; for_work: string; reasoning: string }[];
  // 어느 경로에도 없는 청구 항목 → items에서 불인정
  rejected: {
    line_no: number | null;
    item_name: string;
    reasoning: string;
  }[];
}

export interface AdjustmentResult {
  estimate_provided: boolean;
  repair_plan?: RepairPlan;
  items: AdjustmentItem[];
  physical_consistency: PhysicalConsistency;
}

export interface AdjustmentCaseInfo {
  manufacturer?: string;
  model?: string;
}
