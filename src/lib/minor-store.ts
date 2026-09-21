import type { MinorCaseInfo, MinorPartInput, MinorResult } from "./minor-types";
import {
  caseTitleOf,
  createCaseStore,
  newCaseId,
  type StoredFiles,
} from "./case-store";

// 경미손상판독 건별 캐시 (IndexedDB "carshare-minor")
export type { StoredFiles };

export interface StoredMinorCase {
  id: string;
  createdAt: number;
  plateNo: string;
  manufacturer: string;
  model: string;
  year: string;
  memo: string;
  parts: MinorPartInput[];
  photoCount: number;
  result: MinorResult | null;
  jobId?: string | null;
  jobImageUrls?: string[];
  caseInfo: MinorCaseInfo | null;
}

const store = createCaseStore<StoredMinorCase>("carshare-minor");

export function emptyMinorCase(): StoredMinorCase {
  return {
    id: newCaseId(),
    createdAt: Date.now(),
    plateNo: "",
    manufacturer: "",
    model: "",
    year: "",
    memo: "",
    parts: [],
    photoCount: 0,
    result: null,
    caseInfo: null,
  };
}

export const loadMinorCases = store.loadCases;
export const saveMinorCase = store.saveCase;
export const deleteMinorCase = store.deleteCase;
export const saveMinorFiles = store.saveFiles;
export const loadMinorFiles = store.loadFiles;
export const minorCaseTitle = caseTitleOf;
