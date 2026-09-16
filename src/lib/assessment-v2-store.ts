import type { AssessmentResult } from "./assessment-types";
import type { ReportCaseInfo } from "./format-report";
import type { EstimateTree } from "./estimate-tree";
import type { OpinionEdits } from "./assessment-store";
import {
  caseTitleOf,
  createCaseStore,
  newCaseId,
  type StoredFiles,
} from "./case-store";

// AI선견적(새 디자인: 견적서 표 옆 인라인 판정) 건별 캐시 (IndexedDB "carshare-assessment-v2").
// 구버전 선견적(carshare-assessment)과 캐시를 분리해 결과 형태가 섞이지 않게 함.
export type { StoredFiles, OpinionEdits };

export interface StoredCase {
  id: string;
  createdAt: number;
  plateNo: string;
  manufacturer: string;
  model: string;
  year: string;
  memo: string;
  photoCount: number;
  estimateName: string | null;
  // 선견적을 표로 구조화한 결과(PDF 뷰어 대신 표시, 판정을 행 옆에 붙임)
  estimateTree?: EstimateTree | null;
  estimateTreeStatus?: "idle" | "parsing" | "error";
  result: AssessmentResult | null;
  // 진행 중인 OpenAI 백그라운드 작업(새로고침 후 이어받기용). 끝나면 null
  jobId?: string | null;
  jobImageUrls?: string[];
  caseInfo: ReportCaseInfo | null;
  // 종합의견 편집 상태 — 정상인 항목은 제외하고 문구는 고쳐서 회신
  opinionEdits: OpinionEdits;
}

const store = createCaseStore<StoredCase>("carshare-assessment-v2");

export function emptyCase(): StoredCase {
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

export async function loadCases(): Promise<StoredCase[]> {
  const all = await store.loadCases();
  return all.map((c) => ({
    ...c,
    plateNo: c.plateNo ?? "",
    year: c.year ?? "",
    opinionEdits: c.opinionEdits ?? { excluded: [], text: {} },
  }));
}
export const saveCase = store.saveCase;
export const deleteCase = store.deleteCase;
export const saveFiles = store.saveFiles;
export const loadFiles = store.loadFiles;
export const caseTitle = caseTitleOf;
