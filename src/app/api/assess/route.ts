import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModel, getOpenAI, getReasoningEffort } from "@/lib/openai";
import {
  ASSESSMENT_RESPONSE_SCHEMA,
  PROMPT_VERSION_TAG,
  SYSTEM_PROMPT,
} from "@/lib/assessment-prompt";
import { matchReferenceSections } from "@/lib/reference-sections";
import type { AssessmentResult, VehicleInfo } from "@/lib/assessment-types";
import { getCurrentUser } from "@/lib/session";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";
import { isPdfFile, extractEstimateText } from "@/lib/estimate-pdf";
import { redactPersonalInfo } from "@/lib/pii-redact";

export const runtime = "nodejs";
export const maxDuration = 120;

async function getActivePromptVersion() {
  const active = await prisma.promptVersion.findFirst({ where: { isActive: true } });
  if (active) return active;
  return prisma.promptVersion.create({
    data: {
      createdBy: "system",
      promptText: SYSTEM_PROMPT,
      changeSummary: `초기 버전 (${PROMPT_VERSION_TAG})`,
      isActive: true,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    return await handleAssess(req);
  } catch (err) {
    console.error("[/api/assess] failed:", err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleAssess(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const form = await req.formData();

  const vehicle: VehicleInfo = {
    manufacturer: String(form.get("manufacturer") ?? ""),
    model: String(form.get("model") ?? ""),
    year: form.get("year") ? Number(form.get("year")) : undefined,
    damagedPart: form.get("damagedPart") ? String(form.get("damagedPart")) : undefined,
    memo: form.get("memo") ? String(form.get("memo")) : undefined,
  };

  const imageFiles = form.getAll("images").filter((f): f is File => f instanceof File);
  if (imageFiles.length === 0) {
    return NextResponse.json({ error: "사진을 1장 이상 첨부해주세요." }, { status: 400 });
  }

  const estimateFile = form.get("estimate");
  const hasEstimate = estimateFile instanceof File && estimateFile.size > 0;
  if (hasEstimate && !isPdfFile(estimateFile as File)) {
    return NextResponse.json({ error: "선견적은 PDF 파일만 첨부 가능합니다." }, { status: 400 });
  }

  const [images, rawEstimateText, promptVersion] = await Promise.all([
    Promise.all(
      imageFiles.map(async (file) => ({
        mimeType: file.type || "image/jpeg",
        buffer: Buffer.from(await file.arrayBuffer()),
      }))
    ),
    hasEstimate ? extractEstimateText(estimateFile as File) : Promise.resolve(null),
    getActivePromptVersion(),
  ]);

  // 선견적 원문에서 고객명·연락처·주소 등 개인정보를 지운 뒤에만 AI 프롬프트에
  // 쓰고, 이 텍스트 자체도 DB에 저장하지 않음(사진과 동일한 정책).
  const estimateText = rawEstimateText ? redactPersonalInfo(rawEstimateText) : null;

  const matchedSections = matchReferenceSections(estimateText);

  const contextLines = [
    `차량정보: ${vehicle.manufacturer} ${vehicle.model} ${vehicle.year ? vehicle.year + "년식" : ""}`.trim(),
    vehicle.damagedPart ? `신고된 손상부위: ${vehicle.damagedPart}` : null,
    vehicle.memo ? `[담당자 추가 의견]\n${vehicle.memo}` : null,
    estimateText
      ? `[선견적 원문 텍스트]\n${estimateText}`
      : "선견적 데이터가 제공되지 않았습니다. 사진 기반 손상유형 판독만 수행하십시오.",
    ...matchedSections.map(
      (s) => `[추가 참고자료: ${s.name}]\n${s.content}`
    ),
  ].filter(Boolean);

  const openai = getOpenAI();
  const reasoningEffort = getReasoningEffort("low");
  const completion = await openai.chat.completions.create({
    model: getModel(),
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: contextLines.join("\n\n") },
          ...images.map((img) => ({
            type: "image_url" as const,
            image_url: {
              url: `data:${img.mimeType};base64,${img.buffer.toString("base64")}`,
            },
          })),
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "assessment_result",
        schema: ASSESSMENT_RESPONSE_SCHEMA,
        strict: true,
      },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return NextResponse.json({ error: "AI 응답을 받지 못했습니다." }, { status: 502 });
  }
  const aiResult: AssessmentResult = JSON.parse(raw);

  // 사진과 선견적 원문은 위에서 GPT 호출에만 쓰고 DB에는 저장하지 않음
  // (개인정보 보관 최소화 방침 — 사진과 동일하게 적용).
  const created = await prisma.assessmentCase.create({
    data: {
      userId: user.id,
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      year: vehicle.year,
      damagedPart: vehicle.damagedPart,
      memo: vehicle.memo,
      aiResult: aiResult as unknown as object,
      promptVersionId: promptVersion.id,
    },
  });

  const { ip, userAgent } = getRequestMeta(req);
  void logAudit({
    action: AuditAction.ASSESSMENT_SUBMITTED,
    actorUserId: user.id,
    actorEmployeeId: user.employeeId,
    targetType: "AssessmentCase",
    targetId: created.id,
    detail: `${vehicle.manufacturer} ${vehicle.model}`,
    ip,
    userAgent,
  });

  return NextResponse.json({ id: created.id, result: aiResult });
}
