import type { Confidence, DamageType } from "./assessment-types";

// 부품의 좌/우 위치. 도해 매칭과 작업 지시 둘 다 이 필드를 근거로 삼음 —
// part_name 자유 텍스트에서 추측하지 않음. 중앙 부품(후드·트렁크·범퍼 등)은
// "중앙", 실제로 양쪽 다 손상된 게 확인될 때만 "양쪽"으로 표시함.
export type PartSide = "좌" | "우" | "중앙" | "양쪽";

export interface DamagedPartSummary {
  part_name: string;
  side: PartSide;
  damage_type: DamageType;
  reasoning: string;
  evidence_confidence: Confidence;
}

export type SuspicionLevel = "높음" | "중간" | "낮음";

// 사진에 직접 보이지는 않지만, 충격 강도·손상 패턴으로 볼 때 정비 전문가라면
// 당연히 의심할 2차/구조 손상. 최종 확인은 사람이 하지만 그 판단 재료를
// AI가 먼저 제시하는 것 — 눈에 보이는 것만 나열하면 이 도구를 쓰는 의미가 없음.
// 단, 손상 강도에 비례해서 제시해야 함(원칙은 procedure-prompt.ts 참고).
export interface SuspectedHiddenDamage {
  item: string;
  side: PartSide;
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
