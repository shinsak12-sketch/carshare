// 도구별 건(case) 캐시 — 브라우저 IndexedDB에만 저장(서버 미저장 정책 유지).
// 새로고침하거나 다른 기능 갔다 와도 마지막 결과·사진·견적서를 다시 안 넣게 함.
// 사진 수십 장 = 토큰 수만 개라 결과 한 번 잃으면 비용이 커서.

export interface StoredFiles {
  estimate: File | null;
  photos: File[];
}

const CASES = "cases";
const FILES = "files";

// 계정별 분리: IndexedDB는 브라우저(출처) 단위라 같은 PC에서 다른 계정으로 로그인하면
// 남의 건이 보인다. 레이아웃이 로그인한 사용자 ID로 scope를 잡고, DB 이름 뒤에 붙여 나눈다.
let scope = "";
const LEGACY_DBS = [
  "carshare-assessment",
  "carshare-assessment-v2",
  "carshare-adjustment",
  "carshare-adjustment-lab",
  "carshare-procedure",
  "carshare-minor",
];
let legacyCleaned = false;

export function setCaseScope(userId: string) {
  scope = userId;
  if (legacyCleaned || typeof indexedDB === "undefined") return;
  legacyCleaned = true;
  // 계정 구분 없이 저장돼 있던 예전 DB는 지움(다른 계정 건이 섞여 있을 수 있어서)
  for (const name of LEGACY_DBS) {
    try {
      indexedDB.deleteDatabase(name);
    } catch {
      // 무시
    }
  }
  try {
    localStorage.removeItem("carshare-sketch");
  } catch {
    // 무시
  }
}

export function getCaseScope(): string {
  return scope;
}

function scopedName(dbName: string): string {
  if (!scope) console.warn("[case-store] 사용자 scope 없이 열림:", dbName);
  return `${dbName}--${scope || "anon"}`;
}

export function newCaseId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createCaseStore<C extends { id: string; createdAt: number }>(
  dbName: string,
) {
  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(scopedName(dbName), 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CASES))
          db.createObjectStore(CASES, { keyPath: "id" });
        if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function tx<T>(
    store: string,
    mode: IDBTransactionMode,
    run: (s: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return openDb().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const t = db.transaction(store, mode);
          const req = run(t.objectStore(store));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
          t.oncomplete = () => db.close();
        }),
    );
  }

  return {
    async loadCases(): Promise<C[]> {
      try {
        const all = await tx<C[]>(CASES, "readonly", (s) => s.getAll());
        return all.sort((a, b) => a.createdAt - b.createdAt);
      } catch {
        return [];
      }
    },
    async saveCase(c: C): Promise<void> {
      try {
        await tx(CASES, "readwrite", (s) => s.put(c));
      } catch {
        // 시크릿 모드 등 저장 불가 환경 — 캐시 없이 계속
      }
    },
    async deleteCase(id: string): Promise<void> {
      try {
        await tx(CASES, "readwrite", (s) => s.delete(id));
        await tx(FILES, "readwrite", (s) => s.delete(id));
      } catch {
        // 무시
      }
    },
    async saveFiles(id: string, files: StoredFiles): Promise<void> {
      try {
        await tx(FILES, "readwrite", (s) => s.put(files, id));
      } catch {
        // 용량 초과 등 — 결과 캐시만이라도 남김
      }
    },
    async loadFiles(id: string): Promise<StoredFiles> {
      try {
        const f = await tx<StoredFiles | undefined>(FILES, "readonly", (s) =>
          s.get(id),
        );
        return f ?? { estimate: null, photos: [] };
      } catch {
        return { estimate: null, photos: [] };
      }
    },
  };
}

// 탭 이름: 차량번호 > 제조사 모델 > 새 건 N
export function caseTitleOf(
  c: { plateNo?: string; manufacturer: string; model: string },
  index: number,
): string {
  const plate = (c.plateNo ?? "").trim();
  if (plate) return plate;
  const name = `${c.manufacturer} ${c.model}`.trim();
  return name || `새 건 ${index + 1}`;
}
