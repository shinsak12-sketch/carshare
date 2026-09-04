export type DamageType = "1유형" | "2유형" | "3유형" | "비대상(교환예외)" | "손상없음";
export type Confidence = "높음" | "중간" | "낮음";
export type ReferenceVerdict = "적정" | "과다" | "과소" | "기준 미제공 - 확인 필요";
export type GeneralAssessment = "적정" | "과다 의심" | "과소 의심" | "판단 어려움";
export type PartVerdict = "인정가능" | "협의대상" | "불인정";

export interface AncillaryWorkCheck {
  item: string;
  in_allowed_list: boolean | null; // 회사 참고자료 기준 (자료 없으면 null)
  mechanically_plausible: boolean; // 정비 지식으로 내리는 직접 판단 (항상 채움)
  note: string;
}

export interface PartAssessment {
  part_name: string;
  claimed_action: string;
  damage_type: DamageType;
  reasoning: string;
  evidence_confidence: Confidence;
  labor_time_check: {
    claimed_h: number | null;
    reference_h: number | null; // 회사 참고자료 기준 (없으면 null)
    reference_verdict: ReferenceVerdict; // 회사 기준 대비 판정
    general_assessment: GeneralAssessment; // 정비 지식으로 내리는 직접 판단 (항상 채움)
    note: string;
  };
  ancillary_work_check: AncillaryWorkCheck[];
  verdict: PartVerdict;
  required_action: string;
}

export interface RepairScopeConcern {
  item: string;
  issue: string;
  reasoning: string;
}

export interface OverallRepairScopeReview {
  appropriate: boolean;
  concerns: RepairScopeConcern[];
}

export type OtherFindingVerdict = "인정가능" | "협의대상" | "불인정" | "확인불가";

export interface OtherFinding {
  category: string;
  description: string;
  reference_basis: string;
  verdict: OtherFindingVerdict;
}

export interface PhysicalConsistency {
  consistent: boolean;
  warning: string;
}

export interface AssessmentResult {
  estimate_provided: boolean;
  overall_repair_scope_review: OverallRepairScopeReview;
  parts: PartAssessment[];
  claimed_but_not_visible: string[];
  damage_but_not_claimed: string[];
  other_findings: OtherFinding[];
  physical_consistency: PhysicalConsistency;
  overall_opinion: string;
  disputed_items: string[];
}

export interface VehicleInfo {
  manufacturer: string;
  model: string;
  year?: number;
  damagedPart?: string;
  memo?: string;
}
