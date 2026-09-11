import { after, NextRequest, NextResponse } from "next/server";
import { startStructuredJob } from "@/lib/ai-job";
import {
  PROCEDURE_RESPONSE_SCHEMA,
  PROCEDURE_SYSTEM_PROMPT,
} from "@/lib/procedure-prompt";
import { getCurrentUser } from "@/lib/session";
import { sweepStaleBlobs } from "@/lib/blob-cleanup";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    return await handleProcedure(req);
  } catch (err) {
    console.error("[/api/procedure] failed:", err);
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleProcedure(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const form = await req.formData();
  const manufacturer = form.get("manufacturer")
    ? String(form.get("manufacturer"))
    : "";
  const model = form.get("model") ? String(form.get("model")) : "";
  const memo = form.get("memo") ? String(form.get("memo")) : "";

  // 사진은 손해사정·선견적과 같은 절차 — 브라우저에서 Vercel Blob으로 직접 업로드되고,
  // 이 라우트에는 그 결과 URL 목록만 텍스트로 전달됨(서버 요청 바디 제한과 무관).
  const imageUrlsRaw = form.get("imageUrls")
    ? String(form.get("imageUrls"))
    : "[]";
  let imageUrls: string[];
  try {
    imageUrls = JSON.parse(imageUrlsRaw);
  } catch {
    imageUrls = [];
  }
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return NextResponse.json(
      { error: "파손 사진을 1장 이상 첨부해주세요." },
      { status: 400 },
    );
  }

  const contextLines = [
    manufacturer || model ? `차량정보: ${manufacturer} ${model}`.trim() : null,
    memo ? `[담당자 메모]\n${memo}` : null,
    "선견적 없이 파손 사진만으로 사전 판단을 수행하십시오.",
    `첨부된 사진은 총 ${imageUrls.length}장이며 첨부 순서대로 1번부터 번호가 매겨져 있습니다.`,
  ].filter(Boolean);

  // 백그라운드 작업으로 시작만 하고 작업 ID 반환. 사진(Blob)은 작업이 끝날 때 /api/ai-job 에서 지움.
  const started = await startStructuredJob({
    system: PROCEDURE_SYSTEM_PROMPT,
    userText: contextLines.join("\n\n"),
    imageUrls,
    schemaName: "procedure_result",
    schema: PROCEDURE_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    effort: "medium",
  });

  const { ip, userAgent } = getRequestMeta(req);
  void logAudit({
    action: AuditAction.PROCEDURE_CHECKED,
    actorUserId: user.id,
    actorEmployeeId: user.employeeId,
    detail: `${manufacturer} ${model}`.trim() || "차량정보 미입력",
    ip,
    userAgent,
  });

  after(async () => {
    await sweepStaleBlobs("/api/procedure");
  });

  return NextResponse.json(started);
}
