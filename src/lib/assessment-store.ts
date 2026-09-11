import type { AssessmentResult } from "./assessment-types";
import type { ReportCaseInfo } from "./format-report";
import {
  caseTitleOf,
  createCaseStore,
  newCaseId,
  type StoredFiles,
} from "./case-store";

// AI선견적 건별 캐시 (IndexedDB "carshare-assessment")
export type { StoredFiles };

// 종합의견 편집 상태 — 담당자가 봤을 때 정상인 항목은 제외하고, 문구는 고쳐서 회신
export interface OpinionEdits {
  excluded: number[];
  text: Record<number, string>;
}

export interface StoredAssessCase {
  id: string;
  createdAt: number;
  plateNo: string;
  manufacturer: string;
  model: string;
  year: string;
  memo: string;
  photoCount: number;
  estimateName: string | null;
  result: AssessmentResult | null;
  caseInfo: ReportCaseInfo | null;
  opinionEdits: OpinionEdits;
}

const store = createCaseStore<StoredAssessCase>("carshare-assessment");

export function emptyAssessCase(): StoredAssessCase {
  return {
    id: newCaseId(),
    createdAt: Date.now(),
    plateNo: "",
    manufacturer: "",
    model: "",
    year: "",
    memo: "",
    photoCount: 0,
    estimateName: null,
    result: null,
    caseInfo: null,
    opinionEdits: { excluded: [], text: {} },
  };
}

export const loadAssessCases = store.loadCases;
export const saveAssessCase = store.saveCase;
export const deleteAssessCase = store.deleteCase;
export const saveAssessFiles = store.saveFiles;
export const loadAssessFiles = store.loadFiles;
export const assessCaseTitle = caseTitleOf;
