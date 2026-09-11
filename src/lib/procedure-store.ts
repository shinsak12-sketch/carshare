import type { ProcedureResult } from "./procedure-types";
import type { ProcedureCaseInfo } from "./format-procedure-report";
import {
  caseTitleOf,
  createCaseStore,
  newCaseId,
  type StoredFiles,
} from "./case-store";

// 정비공정 건별 캐시 (IndexedDB "carshare-procedure")
export type { StoredFiles };

export interface StoredProcedureCase {
  id: string;
  createdAt: number;
  plateNo: string;
  manufacturer: string;
  model: string;
  memo: string;
  photoCount: number;
  estimateName: string | null;
  result: ProcedureResult | null;
  // 진행 중인 OpenAI 백그라운드 작업(새로고침 후 이어받기용). 끝나면 null
  jobId?: string | null;
  jobImageUrls?: string[];
  caseInfo: ProcedureCaseInfo | null;
  summaryDraft: string;
}

const store = createCaseStore<StoredProcedureCase>("carshare-procedure");

export function emptyProcedureCase(): StoredProcedureCase {
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
    summaryDraft: "",
  };
}

export const loadProcedureCases = store.loadCases;
export const saveProcedureCase = store.saveCase;
export const deleteProcedureCase = store.deleteCase;
export const saveProcedureFiles = store.saveFiles;
export const loadProcedureFiles = store.loadFiles;
export const procedureCaseTitle = caseTitleOf;
