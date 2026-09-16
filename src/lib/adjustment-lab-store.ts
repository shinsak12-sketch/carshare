import type { AdjustmentCaseInfo, AdjustmentResult } from "./adjustment-types";
import type { EstimateTree } from "./estimate-tree";
import {
  caseTitleOf,
  createCaseStore,
  newCaseId,
  type StoredFiles,
} from "./case-store";

// AI손해사정(실험) 건별 캐시 (IndexedDB "carshare-adjustment-lab")
export type { StoredFiles };

export interface StoredCase {
  id: string;
  createdAt: number;
  plateNo: string;
  manufacturer: string;
  model: string;
  memo: string;
  photoCount: number;
  estimateName: string | null;
  // [실험] 견적서를 부위별 트리로 구조화한 결과(PDF 뷰어 대신 표시)
  estimateTree?: EstimateTree | null;
  estimateTreeStatus?: "idle" | "parsing" | "error";
  result: AdjustmentResult | null;
  // 진행 중인 OpenAI 백그라운드 작업(새로고침 후 이어받기용). 끝나면 null
  jobId?: string | null;
  jobImageUrls?: string[];
  caseInfo: AdjustmentCaseInfo | null;
}

const store = createCaseStore<StoredCase>("carshare-adjustment-lab");

export function emptyCase(): StoredCase {
  return {
    id: newCaseId(),
    createdAt: Date.now(),
    plateNo: "",
    manufacturer: "",
    model: "",
    memo: "",
    photoCount: 0,
    estimateName: null,
    result: null,
    caseInfo: null,
  };
}

export async function loadCases(): Promise<StoredCase[]> {
  const all = await store.loadCases();
  return all.map((c) => ({ ...c, plateNo: c.plateNo ?? "" }));
}
export const saveCase = store.saveCase;
export const deleteCase = store.deleteCase;
export const saveFiles = store.saveFiles;
export const loadFiles = store.loadFiles;
export const caseTitle = caseTitleOf;
