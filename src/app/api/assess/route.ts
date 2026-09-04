import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getOpenAI } from "@/lib/openai";
import {
  ASSESSMENT_RESPONSE_SCHEMA,
  PROMPT_VERSION_TAG,
  SYSTEM_PROMPT,
} from "@/lib/assessment-prompt";
import type { AssessmentResult, VehicleInfo } from "@/lib/assessment-types";

export const runtime = "nodejs";
export const maxDuration = 60;

async function extractEstimateText(file: File): Promise<string | null> {
  if (file.type !== "application/pdf") return null;
  const { PDFParse } = await import("pdf-parse");
  const data = new Uint8Array(await file.arrayBuffer());
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

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
  const form = await req.formData();

  const vehicle: VehicleInfo = {
    manufacturer: String(form.get("manufacturer") ?? ""),
    model: String(form.get("model") ?? ""),
    year: form.get("year") ? Number(form.get("year")) : undefined,
    damagedPart: form.get("damagedPart") ? String(form.get("damagedPart")) : undefined,
    memo: form.get("memo") ? String(form.get("memo")) : undefined,
  };
  const createdBy = String(form.get("createdBy") ?? "익명");

  const imageFiles = form.getAll("images").filter((f): f is File => f instanceof File);
  if (imageFiles.length === 0) {
    return NextResponse.json({ error: "사진을 1장 이상 첨부해주세요." }, { status: 400 });
  }

  const estimateFile = form.get("estimate");
  const hasEstimate = estimateFile instanceof File && estimateFile.size > 0;

  const [imageUploads, estimateUpload, estimateText, promptVersion] = await Promise.all([
    Promise.all(
      imageFiles.map((file, i) =>
        put(`assessments/${Date.now()}-${i}-${file.name}`, file, { access: "public" })
      )
    ),
    hasEstimate
      ? put(`estimates/${Date.now()}-${(estimateFile as File).name}`, estimateFile as File, {
          access: "public",
        })
      : Promise.resolve(null),
    hasEstimate ? extractEstimateText(estimateFile as File) : Promise.resolve(null),
    getActivePromptVersion(),
  ]);

  const imageUrls = imageUploads.map((u) => u.url);

  const contextLines = [
    `차량정보: ${vehicle.manufacturer} ${vehicle.model} ${vehicle.year ? vehicle.year + "년식" : ""}`.trim(),
    vehicle.damagedPart ? `신고된 손상부위: ${vehicle.damagedPart}` : null,
    vehicle.memo ? `사고 경위 메모: ${vehicle.memo}` : null,
    estimateText
      ? `[선견적 원문 텍스트]\n${estimateText}`
      : "선견적 데이터가 제공되지 않았습니다. 사진 기반 손상유형 판독만 수행하십시오.",
  ].filter(Boolean);

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
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

  const created = await prisma.assessmentCase.create({
    data: {
      createdBy,
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      year: vehicle.year,
      damagedPart: vehicle.damagedPart,
      memo: vehicle.memo,
      imageUrls,
      estimateUrl: estimateUpload?.url,
      estimateText: estimateText ?? undefined,
      aiResult: aiResult as unknown as object,
      promptVersionId: promptVersion.id,
    },
  });

  return NextResponse.json({ id: created.id, result: aiResult });
}
