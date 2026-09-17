"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrintReport } from "@/components/PrintReport";
import { buildAssessmentDiagnostics } from "@/lib/assessment-diagnostics";
import { buildEditedOpinion } from "@/lib/format-report";
import {
  loadCases,
  loadFiles,
  type StoredCase,
} from "@/lib/assessment-v2-store";

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

  const r = c.result;
  const opinion = buildEditedOpinion(r.overall_opinion, c.opinionEdits);
  const tail = r.disputed_items.length
    ? `\n\n협의 필요 항목: ${r.disputed_items.join(", ")}`
    : "";
  return (
    <PrintReport
      title="AI 선견적 검토 보고서"
      toolLabel="선견적진단"
      accent="blue"
      header={[
        { label: "차량번호", value: c.plateNo },
        {
          label: "차종",
          value:
            `${c.manufacturer} ${c.model}${c.year ? ` (${c.year}년식)` : ""}`.trim(),
        },
        { label: "사진", value: `${c.photoCount || photos.length}장` },
        { label: "선견적", value: c.estimateName ?? "" },
      ]}
      memo={c.memo}
      diagnostics={buildAssessmentDiagnostics(r)}
      estimateTree={c.estimateTree}
      opinion={opinion ? opinion + tail : null}
      lists={[
        {
          label: "청구되었으나 사진에서 확인되지 않음",
          items: r.claimed_but_not_visible,
        },
        {
          label: "사진에는 있으나 청구되지 않은 손상",
          items: r.damage_but_not_claimed,
        },
        {
          label: "기타 검토(참고자료 기준)",
          items: r.other_findings.map(
            (f) => `${f.category}: ${f.description} [${f.verdict}]`,
          ),
        },
      ]}
      photos={photos}
      createdAt={c.createdAt}
    />
  );
}

export default function AssessReportPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
