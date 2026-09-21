export type DamageType =
  | "1유형"
  | "2유형"
  | "3유형"
  | "비대상(교환예외)"
  | "손상없음";
export type Confidence = "높음" | "중간" | "낮음";
export type ReferenceVerdict =
  | "적정"
  | "과다"
  | "과소"
  | "기준 미제공 - 확인 필요";
export type GeneralAssessment =
  | "적정"
  | "과다 의심"
  | "과소 의심"
  | "판단 어려움";
export type PartVerdict = "인정가능" | "협의대상" | "불인정";

export interface AncillaryWorkCheck {
  item: string;
  in_allowed_list: boolean | null; // 회사 참고자료 기준 (자료 없으면 null)
  mechanically_plausible: boolean; // 정비 지식으로 내리는 직접 판단 (항상 채움)
  note: string;
}

export interface PartAssessment {
  part_name: string;
  // 선견적 항목표의 NO(견적서 표 옆에 판정을 붙이기 위한 키). 항목표가 없거나 예전 결과면 null/없음
  line_no?: number | null;
  // 부위(판넬) 그룹과 역할 — 손해사정과 같은 트리(메인 → 도장 → 부수)로 화면에 묶기 위함.
  // 예전 결과에는 없을 수 있어 optional.
  group?: string;
  role?: "메인" | "도장" | "부수";
  claimed_action: string;
  damage_type: DamageType;
  reasoning: string;
  evidence_confidence: Confidence;
  // 필요성 판단 근거: 직접확인 / 추론(사진에 안 보이는 부위를 충격 경로로 추론). 예전 결과엔 없음
  judgment_basis?: "직접확인" | "추론";
  // v5.1부터 판금·복원수리 항목만 채우고 나머지는 null
  labor_time_check: {
    claimed_h: number | null;
    reference_h: number | null; // 회사 참고자료 기준 (없으면 null)
    reference_verdict: ReferenceVerdict; // 회사 기준 대비 판정
    general_assessment: GeneralAssessment; // 정비 지식으로 내리는 직접 판단
    note?: string; // v5.2부터 없음
  } | null;
  ancillary_work_check?: AncillaryWorkCheck[]; // v5.2부터 없음(예전 결과 표시용)
  verdict: PartVerdict;
  // v5.2부터 없음 — 조치는 overall_opinion에. reasoning은 12자 꼬리표(인정가능은 빈 문자열)
  required_action?: string;
  // 판단 근거가 된 파손 사진 번호(1부터). 화면에서 해당 사진 강조에 씀.
  photo_refs?: number[];
}

export interface RepairScopeConcern {
  item: string;
  issue: string;
  reasoning: string;
  photo_refs?: number[];
}

export interface OverallRepairScopeReview {
  appropriate: boolean;
  // v5.1부터 출력하지 않음(parts 판정 요약이라 중복). 예전 결과 표시용
  concerns?: RepairScopeConcern[];
}

export type OtherFindingVerdict =
  | "인정가능"
  | "협의대상"
  | "불인정"
  | "확인불가";

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
  // v5.0부터: 1단계(정비사) 수리 계획. 예전 결과에는 없음
  repair_plan?: import("./adjustment-types").RepairPlan;
  overall_repair_scope_review: OverallRepairScopeReview;
  parts: PartAssessment[];
  claimed_but_not_visible: string[];
  damage_but_not_claimed: string[];
  other_findings?: OtherFinding[]; // v5.2부터 없음
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
