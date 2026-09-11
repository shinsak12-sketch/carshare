import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import {
  createCompletionResilient,
  getModel,
  getOpenAI,
  getReasoningEffort,
} from "@/lib/openai";
import {
  ADJUSTMENT_RESPONSE_SCHEMA,
  ADJUSTMENT_SYSTEM_PROMPT,
} from "@/lib/adjustment-prompt";
import type { AdjustmentResult } from "@/lib/adjustment-types";
import { getCurrentUser } from "@/lib/session";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";
import { isPdfFile, extractEstimateText } from "@/lib/estimate-pdf";
import { redactPersonalInfo } from "@/lib/pii-redact";
import { matchReferenceSections } from "@/lib/reference-sections";

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

  // 개인정보(고객명·연락처·주소 등)를 지운 뒤에만 AI 프롬프트에 사용하고,
  // 이 텍스트 자체도 저장하지 않음(사진과 동일한 정책).
  const estimateText = redactPersonalInfo(rawEstimateText);

  const matchedSections = matchReferenceSections(estimateText);

  const contextLines = [
    manufacturer || model ? `차량정보: ${manufacturer} ${model}`.trim() : null,
    memo ? `[담당자 추가 의견]\n${memo}` : null,
    `[청구 견적서 원문 텍스트]\n${estimateText}`,
    ...matchedSections.map((s) => `[참고자료: ${s.name}]\n${s.content}`),
    `첨부된 사진은 파손 상태 사진이 아니라 수리작업 진행/완료 사진이며, 총 ${imageUrls.length}장이 첨부 순서대로 1번부터 번호가 매겨져 있습니다.`,
  ].filter(Boolean);

  try {
    const openai = getOpenAI();
    // 사진 100장·항목 100개 건은 low로는 뒤쪽 항목이 형식적으로 처리돼서 medium
    const reasoningEffort = getReasoningEffort("medium");
    const completion = await createCompletionResilient(openai, {
      model: getModel(),
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      messages: [
        { role: "system", content: ADJUSTMENT_SYSTEM_PROMPT },
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
          name: "adjustment_result",
          schema: ADJUSTMENT_RESPONSE_SCHEMA,
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
    const result: AdjustmentResult = JSON.parse(raw);

    const { ip, userAgent } = getRequestMeta(req);
    void logAudit({
      action: AuditAction.ADJUSTMENT_CHECKED,
      actorUserId: user.id,
      actorEmployeeId: user.employeeId,
      detail: `${manufacturer} ${model}`.trim() || "차량정보 미입력",
      ip,
      userAgent,
    });

    return NextResponse.json({ result });
  } finally {
    // 사진을 저장하지 않는 정책이라, AI 분석이 끝나면(성공/실패 무관) Blob에서
    // 즉시 삭제함 — Blob은 사진이 GPT에 전달되는 동안만 잠깐 거쳐가는 통로.
    void del(imageUrls).catch((err) => {
      console.error("[/api/adjustment] blob cleanup failed:", err);
    });
  }
}
