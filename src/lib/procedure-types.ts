import type { Confidence, DamageType } from "./assessment-types";

export interface DamagedPartSummary {
  part_name: string;
  damage_type: DamageType;
  reasoning: string;
  evidence_confidence: Confidence;
}

export type SuspicionLevel = "높음" | "중간" | "낮음";

// 사진에 직접 보이지는 않지만, 충격 강도·손상 패턴으로 볼 때 정비 전문가라면
// 당연히 의심할 2차/구조 손상. 최종 확인은 사람이 하지만 그 판단 재료를
// AI가 먼저 제시하는 것 — 눈에 보이는 것만 나열하면 이 도구를 쓰는 의미가 없음.
export interface SuspectedHiddenDamage {
  item: string;
  suspicion_level: SuspicionLevel;
  reasoning: string;
  recommended_check: string;
}

export interface ProcedureStep {
  title: string;
  detail: string;
}

export interface ProcedureStage {
  stage_name: string;
  steps: ProcedureStep[];
}

export interface ProcedurePhysicalConsistency {
  consistent: boolean;
  warning: string;
}

export interface ProcedureResult {
  damaged_parts: DamagedPartSummary[];
  suspected_hidden_damage: SuspectedHiddenDamage[];
  process_stages: ProcedureStage[];
  physical_consistency: ProcedurePhysicalConsistency;
  overall_summary: string;
}

export interface ProcedureVehicleInfo {
  manufacturer?: string;
  model?: string;
  memo?: string;
}
