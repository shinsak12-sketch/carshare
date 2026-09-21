"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MinorReport } from "@/components/MinorReport";
import {
  loadMinorCases,
  loadMinorFiles,
  type StoredMinorCase,
} from "@/lib/minor-store";

function Inner() {
  const sp = useSearchParams();
  const id = sp.get("case");
  const [c, setC] = useState<StoredMinorCase | null | undefined>(undefined);
  const [photos, setPhotos] = useState<File[]>([]);

  useEffect(() => {
    (async () => {
      if (!id) {
        setC(null);
        return;
      }
      const all = await loadMinorCases();
      const found = all.find((x) => x.id === id) ?? null;
      setC(found);
      if (found) setPhotos((await loadMinorFiles(found.id)).photos);
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
    <MinorReport
      header={[
        { label: "차량번호", value: c.plateNo },
        {
          label: "차종",
          value:
            `${c.manufacturer} ${c.model}${c.year ? ` (${c.year}년식)` : ""}`.trim(),
        },
        { label: "사진", value: `${c.photoCount || photos.length}장` },
        {
          label: "판독 부위",
          value: c.parts
            .map((p) =>
              p.side === "중앙" ? p.part_name : `${p.part_name}(${p.side})`,
            )
            .join(", "),
        },
      ]}
      memo={c.memo}
      result={c.result}
      photos={photos}
      createdAt={c.createdAt}
    />
  );
}

export default function MinorReportPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
