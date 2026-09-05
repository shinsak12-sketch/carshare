import type { Confidence, DamageType } from "./assessment-types";

export interface ProcedureAncillaryWork {
  item: string;
  note: string;
}

export interface ProcedurePart {
  part_name: string;
  damage_type: DamageType;
  recommended_action: string;
  reasoning: string;
  evidence_confidence: Confidence;
  ancillary_work: ProcedureAncillaryWork[];
  labor_estimate_note: string;
}

export interface ProcedurePhysicalConsistency {
  consistent: boolean;
  warning: string;
}

export interface ProcedureResult {
  parts: ProcedurePart[];
  physical_consistency: ProcedurePhysicalConsistency;
  overall_summary: string;
}

export interface ProcedureVehicleInfo {
  manufacturer?: string;
  model?: string;
  memo?: string;
}
