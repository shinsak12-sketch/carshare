import { after, NextRequest, NextResponse } from "next/server";
import { startStructuredJob } from "@/lib/ai-job";
import {
  ADJUSTMENT_RESPONSE_SCHEMA,
  ADJUSTMENT_SYSTEM_PROMPT,
} from "@/lib/adjustment-prompt";
import { getCurrentUser } from "@/lib/session";
import { sweepStaleBlobs } from "@/lib/blob-cleanup";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";
import { isPdfFile, extractEstimateText } from "@/lib/estimate-pdf";
import { redactPersonalInfo } from "@/lib/pii-redact";
import { matchReferenceSections } from "@/lib/reference-sections";
import { parseEstimateTable } from "@/lib/estimate-table";
import { buildEstimateTree } from "@/lib/estimate-tree";
import {
  attachJob,
  completeRun,
  createRun,
  estimateAmountOf,
  extractClaimNo,
  extractPlateNo,
  failRun,
  normalizePlate,
} from "@/lib/ai-usage";
import { ADJUSTMENT_PROMPT_VERSION_TAG } from "@/lib/adjustment-prompt";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    return await handleAdjustment(req);
  } catch (err) {
    console.error("[/api/adjustment] failed:", err);
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleAdjustment(req: NextRequest) {
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

  // 사진은 브라우저에서 Vercel Blob으로 직접 업로드되고, 이 라우트에는
  // 그 결과 URL 목록만 텍스트로 전달됨(우리 서버 요청 바디 제한과 무관).
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
      { error: "수리작업 사진을 1장 이상 첨부해주세요." },
      { status: 400 },
    );
  }

  const estimateFile = form.get("estimate");
  if (!(estimateFile instanceof File) || estimateFile.size === 0) {
    return NextResponse.json(
      { error: "청구 견적서(PDF)를 첨부해주세요." },
      { status: 400 },
    );
  }
  if (!isPdfFile(estimateFile)) {
    return NextResponse.json(
      { error: "청구 견적서는 PDF 파일만 첨부 가능합니다." },
      { status: 400 },
    );
  }

  const rawEstimateText = await extractEstimateText(estimateFile);
  // 스캔본·이미지 PDF 금지 + 청구 규모(사정전 합계) 추출
  let estimateAmount: number | null = null;
  try {
    const rows = await parseEstimateTable(
      Buffer.from(await estimateFile.arrayBuffer()),
    );
    if (rows.length) estimateAmount = estimateAmountOf(buildEstimateTree(rows));
  } catch (err) {
    console.warn("[/api/adjustment] estimate table parse failed:", err);
  }
  if (estimateAmount == null) {
    return NextResponse.json(
      {
        error:
          "견적서 항목 표를 읽을 수 없습니다. 스캔본·이미지 PDF는 사용할 수 없으니 AOS에서 내려받은 텍스트 PDF 견적서를 첨부해주세요.",
      },
      { status: 400 },
    );
  }
  const plateNo =
    normalizePlate(form.get("plateNo") ? String(form.get("plateNo")) : null) ??
    extractPlateNo(rawEstimateText);
  const claimNo = extractClaimNo(rawEstimateText);

  // 개인정보(고객명·연락처·주소 등)를 지운 뒤에만 AI 프롬프트에 사용하고,
  // 이 텍스트 자체도 저장하지 않음(사진과 동일한 정책).
  const estimateText = redactPersonalInfo(rawEstimateText);

  const matchedSections = matchReferenceSections(estimateText);

  const contextLines = [
    manufacturer || model ? `차량정보: ${manufacturer} ${model}`.trim() : null,
    memo ? `[담당자 추가 의견]\n${memo}` : null,
    `[청구 견적서 원문 텍스트]\n${estimateText}`,
    ...matchedSections.map((s) => `[참고자료: ${s.name}]\n${s.content}`),
    `첨부된 사진은 총 ${imageUrls.length}장이며 첨부 순서대로 1번부터 번호가 매겨져 있습니다. 수리 전 파손 상태 사진과 수리 작업 진행/완료 사진이 섞여 있으니, 먼저 어느 사진이 수리 전 파손 상태인지 구분한 뒤 판단하십시오.`,
  ].filter(Boolean);

  const run = await createRun({
    user,
    tool: "adjustment",
    promptVersion: ADJUSTMENT_PROMPT_VERSION_TAG,
    photoCount: imageUrls.length,
    estimateAmount,
    plateNo,
    claimNo,
  });

  // 백그라운드 작업으로 시작만 하고 작업 ID 반환. 사진(Blob)은 작업이 끝날 때 /api/ai-job 에서 지움.
  let started;
  try {
    started = await startStructuredJob({
      system: ADJUSTMENT_SYSTEM_PROMPT,
      userText: contextLines.join("\n\n"),
      imageUrls,
      schemaName: "adjustment_result",
      schema: ADJUSTMENT_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      effort: "medium",
    });
  } catch (err) {
    await failRun(run.id, err instanceof Error ? err.message : String(err));
    throw err;
  }
  if ("jobId" in started) await attachJob(run.id, started.jobId);
  else await completeRun(run.id, started.usage, started.result);

  const { ip, userAgent } = getRequestMeta(req);
  void logAudit({
    action: AuditAction.ADJUSTMENT_CHECKED,
    actorUserId: user.id,
    actorEmployeeId: user.employeeId,
    detail: `${manufacturer} ${model}`.trim() || "차량정보 미입력",
    ip,
    userAgent,
  });

  after(async () => {
    await sweepStaleBlobs("/api/adjustment");
  });

  return NextResponse.json(
    "jobId" in started ? started : { result: started.result },
  );
}
