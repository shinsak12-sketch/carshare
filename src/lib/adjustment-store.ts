import type { AdjustmentCaseInfo, AdjustmentResult } from "./adjustment-types";
import {
  caseTitleOf,
  createCaseStore,
  newCaseId,
  type StoredFiles,
} from "./case-store";

// AI손해사정 건별 캐시 (IndexedDB "carshare-adjustment")
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
  result: AdjustmentResult | null;
  caseInfo: AdjustmentCaseInfo | null;
}

const store = createCaseStore<StoredCase>("carshare-adjustment");

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
