import type { Confidence, DamageType } from "./assessment-types";

export interface DamagedPartSummary {
  part_name: string;
  damage_type: DamageType;
  reasoning: string;
  evidence_confidence: Confidence;
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
  process_stages: ProcedureStage[];
  physical_consistency: ProcedurePhysicalConsistency;
  overall_summary: string;
}

export interface ProcedureVehicleInfo {
  manufacturer?: string;
  model?: string;
  memo?: string;
}
