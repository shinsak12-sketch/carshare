import { NextRequest, NextResponse } from "next/server";
import { getModel, getOpenAI, getReasoningEffort } from "@/lib/openai";
import { ADJUSTMENT_RESPONSE_SCHEMA, ADJUSTMENT_SYSTEM_PROMPT } from "@/lib/adjustment-prompt";
import type { AdjustmentResult } from "@/lib/adjustment-types";
import { getCurrentUser } from "@/lib/session";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";
import { isPdfFile, extractEstimateText } from "@/lib/estimate-pdf";
import { redactPersonalInfo } from "@/lib/pii-redact";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    return await handleAdjustment(req);
  } catch (err) {
    console.error("[/api/adjustment] failed:", err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleAdjustment(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const form = await req.formData();
  const manufacturer = form.get("manufacturer") ? String(form.get("manufacturer")) : "";
  const model = form.get("model") ? String(form.get("model")) : "";
  const memo = form.get("memo") ? String(form.get("memo")) : "";

  const imageFiles = form.getAll("images").filter((f): f is File => f instanceof File);
  if (imageFiles.length === 0) {
    return NextResponse.json({ error: "수리작업 사진을 1장 이상 첨부해주세요." }, { status: 400 });
  }

  const estimateFile = form.get("estimate");
  if (!(estimateFile instanceof File) || estimateFile.size === 0) {
    return NextResponse.json({ error: "청구 견적서(PDF)를 첨부해주세요." }, { status: 400 });
  }
  if (!isPdfFile(estimateFile)) {
    return NextResponse.json({ error: "청구 견적서는 PDF 파일만 첨부 가능합니다." }, { status: 400 });
  }

  const [images, rawEstimateText] = await Promise.all([
    Promise.all(
      imageFiles.map(async (file) => ({
        mimeType: file.type || "image/jpeg",
        buffer: Buffer.from(await file.arrayBuffer()),
      }))
    ),
    extractEstimateText(estimateFile),
  ]);

  // 개인정보(고객명·연락처·주소 등)를 지운 뒤에만 AI 프롬프트에 사용하고,
  // 이 텍스트 자체도 저장하지 않음(사진과 동일한 정책).
  const estimateText = redactPersonalInfo(rawEstimateText);

  const contextLines = [
    manufacturer || model ? `차량정보: ${manufacturer} ${model}`.trim() : null,
    memo ? `[담당자 추가 의견]\n${memo}` : null,
    `[청구 견적서 원문 텍스트]\n${estimateText}`,
    "첨부된 사진은 파손 상태 사진이 아니라 수리작업 진행/완료 사진입니다.",
  ].filter(Boolean);

  const openai = getOpenAI();
  const reasoningEffort = getReasoningEffort("low");
  const completion = await openai.chat.completions.create({
    model: getModel(),
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    messages: [
      { role: "system", content: ADJUSTMENT_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: contextLines.join("\n\n") },
          ...images.map((img) => ({
            type: "image_url" as const,
            image_url: { url: `data:${img.mimeType};base64,${img.buffer.toString("base64")}` },
          })),
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "adjustment_result", schema: ADJUSTMENT_RESPONSE_SCHEMA, strict: true },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return NextResponse.json({ error: "AI 응답을 받지 못했습니다." }, { status: 502 });
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
}
