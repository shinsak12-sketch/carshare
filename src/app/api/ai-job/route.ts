import { after, NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { ackJob, getJobStatus } from "@/lib/ai-job";
import { deleteBlobs, sweepStaleBlobs } from "@/lib/blob-cleanup";
import { completeRunByJob, failRunByJob, getRunByJob } from "@/lib/ai-usage";

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

  let body: { id?: string; imageUrls?: string[]; ack?: boolean };
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

  // 브라우저가 결과를 저장했다는 확인 → 이제 OpenAI 저장본을 지움
  if (body.ack === true) {
    await ackJob(id);
    return NextResponse.json({ ok: true });
  }

  try {
    const status = await getJobStatus(id);
    // 저장본이 없는데 기록상 성공한 작업 = 다른 탭이 결과를 받아 저장하고 ack로 지운 것.
    // 실패로 기록하지 말고, 이 탭에는 새로고침해서 저장된 결과를 보라고 알린다.
    if (status.status === "failed" && status.notFound) {
      const run = await getRunByJob(id).catch(() => null);
      if (run?.status === "succeeded")
        return NextResponse.json({
          status: "failed",
          code: "already_collected",
          error:
            "이 작업의 결과는 이미 다른 탭에서 받아 저장됐습니다. 페이지를 새로고침하면 결과가 보입니다.",
        });
    }
    if (status.status === "completed" || status.status === "failed") {
      // 사용량 기록 확정(토큰·비용). 결과 본문은 저장하지 않고 판정 집계만.
      try {
        if (status.status === "completed")
          await completeRunByJob(id, status.usage, status.result);
        else await failRunByJob(id, status.error, status.usage);
      } catch (e) {
        console.error("[/api/ai-job] usage record failed:", e);
      }
      after(async () => {
        await deleteBlobs(imageUrls, "/api/ai-job");
        await sweepStaleBlobs("/api/ai-job");
      });
    }
    // usage는 서버 기록용 — 브라우저엔 상태·결과만 돌려줌
    if (status.status === "completed")
      return NextResponse.json({ status: "completed", result: status.result });
    if (status.status === "failed")
      return NextResponse.json({ status: "failed", error: status.error });
    return NextResponse.json(status);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
