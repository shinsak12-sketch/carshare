import type { AdjustmentCaseInfo, AdjustmentResult } from "./adjustment-types";

// AI손해사정 건별 캐시 — 브라우저 IndexedDB에만 저장(서버 미저장 정책 유지).
// 새로고침하거나 다른 기능 갔다 와도 마지막 결과·사진·견적서를 다시 안 넣게 함.
// 사진 100장 = 토큰 10만 개라 결과 한 번 잃으면 비용이 커서.

export interface StoredCase {
  id: string;
  createdAt: number;
  manufacturer: string;
  model: string;
  memo: string;
  photoCount: number;
  estimateName: string | null;
  result: AdjustmentResult | null;
  caseInfo: AdjustmentCaseInfo | null;
  opinionDraft: string;
}

export interface StoredFiles {
  estimate: File | null;
  photos: File[];
}

const DB_NAME = "carshare-adjustment";
const DB_VERSION = 1;
const CASES = "cases";
const FILES = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CASES)) db.createObjectStore(CASES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

export function newCaseId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyCase(): StoredCase {
  return {
    id: newCaseId(),
    createdAt: Date.now(),
    manufacturer: "",
    model: "",
    memo: "",
    photoCount: 0,
    estimateName: null,
    result: null,
    caseInfo: null,
    opinionDraft: "",
  };
}

export async function loadCases(): Promise<StoredCase[]> {
  try {
    const all = await tx<StoredCase[]>(CASES, "readonly", (s) => s.getAll());
    return all.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function saveCase(c: StoredCase): Promise<void> {
  try {
    await tx(CASES, "readwrite", (s) => s.put(c));
  } catch {
    // 시크릿 모드 등 저장 불가 환경 — 캐시 없이 계속
  }
}

export async function deleteCase(id: string): Promise<void> {
  try {
    await tx(CASES, "readwrite", (s) => s.delete(id));
    await tx(FILES, "readwrite", (s) => s.delete(id));
  } catch {
    // 무시
  }
}

export async function saveFiles(id: string, files: StoredFiles): Promise<void> {
  try {
    await tx(FILES, "readwrite", (s) => s.put(files, id));
  } catch {
    // 용량 초과 등 — 결과 캐시만이라도 남김
  }
}

export async function loadFiles(id: string): Promise<StoredFiles> {
  try {
    const f = await tx<StoredFiles | undefined>(FILES, "readonly", (s) => s.get(id));
    return f ?? { estimate: null, photos: [] };
  } catch {
    return { estimate: null, photos: [] };
  }
}

export function caseTitle(c: StoredCase, index: number): string {
  const name = `${c.manufacturer} ${c.model}`.trim();
  return name || `새 건 ${index + 1}`;
}
