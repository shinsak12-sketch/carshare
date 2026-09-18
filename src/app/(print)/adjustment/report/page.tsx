"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrintReport } from "@/components/PrintReport";
import { buildAdjustmentDiagnostics } from "@/lib/adjustment-review-items";
import {
  loadCases,
  loadFiles,
  type StoredCase,
} from "@/lib/adjustment-lab-store";

function Inner() {
  const sp = useSearchParams();
  const id = sp.get("case");
  const [c, setC] = useState<StoredCase | null | undefined>(undefined);
  const [photos, setPhotos] = useState<File[]>([]);

  useEffect(() => {
    (async () => {
      if (!id) {
        setC(null);
        return;
      }
      const all = await loadCases();
      const found = all.find((x) => x.id === id) ?? null;
      setC(found);
      if (found) setPhotos((await loadFiles(found.id)).photos);
    })();
  }, [id]);

  if (c === undefined)
    return <p className="p-8 text-sm text-slate-500">불러오는 중…</p>;
  if (!c || !c.result)
    return (
      <p className="p-8 text-sm text-slate-500">
        결과를 찾을 수 없습니다. 결과가 있는 브라우저에서 &quot;보고서 ·
        PDF&quot; 버튼으로 여세요.
      </p>
    );

  return (
    <PrintReport
      title="AI 손해사정 검토 보고서"
      toolLabel="AI손해사정"
      accent="purple"
      header={[
        { label: "차량번호", value: c.plateNo },
        { label: "차종", value: `${c.manufacturer} ${c.model}`.trim() },
        { label: "사진", value: `${c.photoCount || photos.length}장` },
        { label: "청구 견적서", value: c.estimateName ?? "" },
      ]}
      memo={c.memo}
      diagnostics={buildAdjustmentDiagnostics(c.result)}
      plan={c.result.repair_plan ?? null}
      estimateTree={c.estimateTree}
      photos={photos}
      createdAt={c.createdAt}
    />
  );
}

export default function AdjustmentReportPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
