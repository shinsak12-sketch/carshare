import { NextRequest, NextResponse } from "next/server";
import { getModel, getOpenAI } from "@/lib/openai";
import { PROCEDURE_RESPONSE_SCHEMA, PROCEDURE_SYSTEM_PROMPT } from "@/lib/procedure-prompt";
import type { ProcedureResult } from "@/lib/procedure-types";
import { getCurrentUser } from "@/lib/session";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    return await handleProcedure(req);
  } catch (err) {
    console.error("[/api/procedure] failed:", err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleProcedure(req: NextRequest) {
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
    return NextResponse.json({ error: "사진을 1장 이상 첨부해주세요." }, { status: 400 });
  }

  const images = await Promise.all(
    imageFiles.map(async (file) => ({
      mimeType: file.type || "image/jpeg",
      buffer: Buffer.from(await file.arrayBuffer()),
    }))
  );

  const contextLines = [
    manufacturer || model ? `차량정보: ${manufacturer} ${model}`.trim() : null,
    memo ? `[담당자 메모]\n${memo}` : null,
    "선견적 없이 파손 사진만으로 사전 판단을 수행하십시오.",
  ].filter(Boolean);

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: getModel(),
    temperature: 0.1,
    messages: [
      { role: "system", content: PROCEDURE_SYSTEM_PROMPT },
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
      json_schema: { name: "procedure_result", schema: PROCEDURE_RESPONSE_SCHEMA, strict: true },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return NextResponse.json({ error: "AI 응답을 받지 못했습니다." }, { status: 502 });
  }
  const result: ProcedureResult = JSON.parse(raw);

  const { ip, userAgent } = getRequestMeta(req);
  await logAudit({
    action: AuditAction.PROCEDURE_CHECKED,
    actorUserId: user.id,
    actorEmployeeId: user.employeeId,
    detail: `${manufacturer} ${model}`.trim() || "차량정보 미입력",
    ip,
    userAgent,
  });

  return NextResponse.json({ result });
}
