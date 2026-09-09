import type { PhysicalConsistency } from "./assessment-types";
import type { VerdictLabel } from "./review-items";

// 선견적진단의 판정 배지(인정/협의필요/과다청구/조사필요/불인정)와 의미가
// 그대로 같아서 타입을 재사용함 — UI 색상도 자동으로 통일됨.
export type AdjustmentVerdict = VerdictLabel;

export type PhotoEvidence = "직접확인" | "간접확인" | "확인불가";

export interface AdjustmentItem {
  item_name: string;
  claimed_action: string;
  photo_evidence: PhotoEvidence;
  verdict: AdjustmentVerdict;
  reasoning: string;
  adjustment_note: string;
}

export interface AdjustmentResult {
  estimate_provided: boolean;
  items: AdjustmentItem[];
  physical_consistency: PhysicalConsistency;
  overall_opinion: string;
}

export interface AdjustmentCaseInfo {
  manufacturer?: string;
  model?: string;
}
