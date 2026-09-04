import { NextRequest, NextResponse } from "next/server";
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
  // pdf-parse의 패키지 루트(index.js)는 require.main 체크가 번들러 환경에서
  // 오작동해 테스트용 하드코딩 파일을 읽으려다 ENOENT가 남 — 내부 구현을
  // 직접 import해서 그 부작용을 우회함.
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await pdfParse(buffer);
  return result.text;
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
  try {
    return await handleAssess(req);
  } catch (err) {
    console.error("[/api/assess] failed:", err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleAssess(req: NextRequest) {
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

  const [images, estimateText, promptVersion] = await Promise.all([
    Promise.all(
      imageFiles.map(async (file) => ({
        mimeType: file.type || "image/jpeg",
        buffer: Buffer.from(await file.arrayBuffer()),
      }))
    ),
    hasEstimate ? extractEstimateText(estimateFile as File) : Promise.resolve(null),
    getActivePromptVersion(),
  ]);

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

  const created = await prisma.assessmentCase.create({
    data: {
      createdBy,
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      year: vehicle.year,
      damagedPart: vehicle.damagedPart,
      memo: vehicle.memo,
      estimateText: estimateText ?? undefined,
      aiResult: aiResult as unknown as object,
      promptVersionId: promptVersion.id,
      images: {
        create: images.map((img) => ({ mimeType: img.mimeType, data: img.buffer })),
      },
    },
  });

  return NextResponse.json({ id: created.id, result: aiResult });
}
