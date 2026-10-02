import type {
  AdjustmentItem,
  AdjustmentResult,
  JudgmentBasis,
  RepairPlan,
} from "./adjustment-types";

// AI손해사정 v2(adj5.0) 결과 — 현행 결과 + 사진 목록·관찰표·근거 인용·자기검증
export type Confidence = "높음" | "중간" | "낮음";

export interface PhotoIndexEntry {
  photo_no: number;
  view: string;
  kind: "수리전" | "작업중" | "완료" | "서류·기타";
  usable: boolean;
}

export interface Observation {
  id: number;
  part_name: string;
  damage_kind: string;
  severity: "경미" | "보통" | "심함";
  photo_refs: number[];
}

export interface Adjustment2Item extends AdjustmentItem {
  evidence_ids: number[];
  confidence: Confidence;
}

export interface RepairPlan2 extends RepairPlan {
  main_works: {
    part_name: string;
    work: string;
    judgment_basis: JudgmentBasis;
    reasoning: string;
    evidence_ids: number[];
  }[];
}

export interface Adjustment2Result extends AdjustmentResult {
  photo_index: PhotoIndexEntry[];
  observations: Observation[];
  repair_plan: RepairPlan2;
  items: Adjustment2Item[];
  self_check: { issue: string; fixed: string }[];
}
