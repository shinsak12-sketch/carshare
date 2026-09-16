import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { isPdfFile } from "@/lib/estimate-pdf";
import { parseEstimateTable } from "@/lib/estimate-table";
import { buildEstimateTree } from "@/lib/estimate-tree";

export const runtime = "nodejs";
export const maxDuration = 60;

// [실험] 견적서 PDF(AOS 양식) → 항목 표를 좌표로 읽어 트리로. GPT 호출 없음(토큰 0).
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );

    const form = await req.formData();
    const file = form.get("estimate");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "견적서 파일이 없습니다." },
        { status: 400 },
      );
    }
    if (!isPdfFile(file)) {
      return NextResponse.json(
        { error: "견적서는 PDF 파일만 첨부 가능합니다." },
        { status: 400 },
      );
    }
    const rows = await parseEstimateTable(
      Buffer.from(await file.arrayBuffer()),
    );
    if (!rows.length) {
      return NextResponse.json(
        { error: "견적서 항목 표를 찾지 못했습니다(양식이 다르거나 스캔본)." },
        { status: 422 },
      );
    }
    return NextResponse.json({ tree: buildEstimateTree(rows) });
  } catch (err) {
    console.error("[/api/estimate-tree] failed:", err);
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
