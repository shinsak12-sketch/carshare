export type DamageType = "1유형" | "2유형" | "3유형" | "비대상(교환예외)" | "손상없음";
export type Confidence = "높음" | "중간" | "낮음";
export type LaborVerdict = "적정" | "과다" | "과소" | "기준 미제공 - 확인 필요";
export type PartVerdict = "인정가능" | "협의대상" | "불인정";

export interface AncillaryWorkCheck {
  item: string;
  in_allowed_list: boolean | null;
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
    reference_h: number | null;
    verdict: LaborVerdict;
  };
  ancillary_work_check: AncillaryWorkCheck[];
  verdict: PartVerdict;
  required_action: string;
}

export interface AssessmentResult {
  estimate_provided: boolean;
  parts: PartAssessment[];
  claimed_but_not_visible: string[];
  damage_but_not_claimed: string[];
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
