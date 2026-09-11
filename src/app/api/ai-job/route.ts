import { after, NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getJobStatus } from "@/lib/ai-job";
import { deleteBlobs, sweepStaleBlobs } from "@/lib/blob-cleanup";

export const runtime = "nodejs";
export const maxDuration = 60;

// 세 도구 공통 작업 상태 조회. 브라우저가 몇 초마다 호출.
// 작업이 끝나면(성공/실패) 그 건의 Blob 사진을 지움 — 사진 URL은 브라우저가 알고 있어 같이 보냄.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );

  let body: { id?: string; imageUrls?: string[] };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const id = typeof body.id === "string" ? body.id : "";
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((u) => typeof u === "string")
    : [];
  if (!/^resp_[A-Za-z0-9_-]+$/.test(id)) {
    return NextResponse.json(
      { error: "잘못된 작업 ID입니다." },
      { status: 400 },
    );
  }

  try {
    const status = await getJobStatus(id);
    if (status.status === "completed" || status.status === "failed") {
      after(async () => {
        await deleteBlobs(imageUrls, "/api/ai-job");
        await sweepStaleBlobs("/api/ai-job");
      });
    }
    return NextResponse.json(status);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
