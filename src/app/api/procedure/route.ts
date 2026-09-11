import { after, NextRequest, NextResponse } from "next/server";
import {
  createCompletionResilient,
  getModel,
  getOpenAI,
  getReasoningEffort,
} from "@/lib/openai";
import {
  PROCEDURE_RESPONSE_SCHEMA,
  PROCEDURE_SYSTEM_PROMPT,
} from "@/lib/procedure-prompt";
import type { ProcedureResult } from "@/lib/procedure-types";
import { getCurrentUser } from "@/lib/session";
import { deleteBlobs, sweepStaleBlobs } from "@/lib/blob-cleanup";
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

  try {
    return await runProcedure(
      req,
      user,
      manufacturer,
      model,
      contextLines,
      imageUrls,
    );
  } finally {
    // 사진을 저장하지 않는 정책이라, AI 분석이 끝나면(성공/실패 무관) Blob에서 즉시 삭제
    // 응답 후 실행 보장(after) — 이 건 사진 삭제 + 오래된 찌꺼기 정리
    after(async () => {
      await deleteBlobs(imageUrls, "/api/procedure");
      await sweepStaleBlobs("/api/procedure");
    });
  }
}

async function runProcedure(
  req: NextRequest,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  manufacturer: string,
  model: string,
  contextLines: (string | null)[],
  imageUrls: string[],
) {
  const openai = getOpenAI();
  // 손해사정·선견적과 동일
  const reasoningEffort = getReasoningEffort("medium");
  const completion = await createCompletionResilient(openai, {
    model: getModel(),
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    messages: [
      { role: "system", content: PROCEDURE_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: contextLines.join("\n\n") },
          ...imageUrls.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "procedure_result",
        schema: PROCEDURE_RESPONSE_SCHEMA,
        strict: true,
      },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return NextResponse.json(
      { error: "AI 응답을 받지 못했습니다." },
      { status: 502 },
    );
  }
  const result: ProcedureResult = JSON.parse(raw);

  const { ip, userAgent } = getRequestMeta(req);
  void logAudit({
    action: AuditAction.PROCEDURE_CHECKED,
    actorUserId: user.id,
    actorEmployeeId: user.employeeId,
    detail: `${manufacturer} ${model}`.trim() || "차량정보 미입력",
    ip,
    userAgent,
  });

  return NextResponse.json({ result });
}
