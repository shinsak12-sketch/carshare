import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import {
  createCompletionResilient,
  getModel,
  getOpenAI,
  getReasoningEffort,
} from "@/lib/openai";
import {
  ASSESSMENT_RESPONSE_SCHEMA,
  SYSTEM_PROMPT,
} from "@/lib/assessment-prompt";
import { matchReferenceSections } from "@/lib/reference-sections";
import type { AssessmentResult, VehicleInfo } from "@/lib/assessment-types";
import { getCurrentUser } from "@/lib/session";
import { AuditAction, getRequestMeta, logAudit } from "@/lib/audit-log";
import { isPdfFile, extractEstimateText } from "@/lib/estimate-pdf";
import { redactPersonalInfo } from "@/lib/pii-redact";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    return await handleAssess(req);
  } catch (err) {
    console.error("[/api/assess] failed:", err);
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleAssess(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const form = await req.formData();

  const vehicle: VehicleInfo = {
    manufacturer: String(form.get("manufacturer") ?? ""),
    model: String(form.get("model") ?? ""),
    year: form.get("year") ? Number(form.get("year")) : undefined,
    damagedPart: form.get("damagedPart")
      ? String(form.get("damagedPart"))
      : undefined,
    memo: form.get("memo") ? String(form.get("memo")) : undefined,
  };

  // 사진은 손해사정과 같은 절차 — 브라우저에서 Vercel Blob으로 직접 업로드되고,
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

  const estimateFile = form.get("estimate");
  const hasEstimate = estimateFile instanceof File && estimateFile.size > 0;
  if (hasEstimate && !isPdfFile(estimateFile as File)) {
    return NextResponse.json(
      { error: "선견적은 PDF 파일만 첨부 가능합니다." },
      { status: 400 },
    );
  }

  try {
    return await runAssess(
      req,
      user,
      vehicle,
      imageUrls,
      hasEstimate ? (estimateFile as File) : null,
    );
  } finally {
    // 사진을 저장하지 않는 정책이라, AI 분석이 끝나면(성공/실패 무관) Blob에서
    // 즉시 삭제함 — Blob은 사진이 GPT에 전달되는 동안만 잠깐 거쳐가는 통로.
    void del(imageUrls).catch((err) => {
      console.error("[/api/assess] blob cleanup failed:", err);
    });
  }
}

async function runAssess(
  req: NextRequest,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  vehicle: VehicleInfo,
  imageUrls: string[],
  estimateFile: File | null,
) {
  const rawEstimateText = estimateFile
    ? await extractEstimateText(estimateFile)
    : null;

  // 선견적 원문에서 고객명·연락처·주소 등 개인정보를 지운 뒤에만 AI 프롬프트에
  // 쓰고, 이 텍스트 자체도 DB에 저장하지 않음(사진과 동일한 정책).
  const estimateText = rawEstimateText
    ? redactPersonalInfo(rawEstimateText)
    : null;

  const matchedSections = matchReferenceSections(estimateText);

  const contextLines = [
    `차량정보: ${vehicle.manufacturer} ${vehicle.model} ${vehicle.year ? vehicle.year + "년식" : ""}`.trim(),
    vehicle.damagedPart ? `신고된 손상부위: ${vehicle.damagedPart}` : null,
    vehicle.memo ? `[담당자 추가 의견]\n${vehicle.memo}` : null,
    estimateText
      ? `[선견적 원문 텍스트]\n${estimateText}`
      : "선견적 데이터가 제공되지 않았습니다. 사진 기반 손상유형 판독만 수행하십시오.",
    ...matchedSections.map((s) => `[참고자료: ${s.name}]\n${s.content}`),
    `첨부된 사진은 총 ${imageUrls.length}장이며 첨부 순서대로 1번부터 번호가 매겨져 있습니다.`,
  ].filter(Boolean);

  const openai = getOpenAI();
  // 손해사정과 동일 — 사진이 많으면 low로는 뒤쪽 사진·항목이 형식적으로 처리됨
  const reasoningEffort = getReasoningEffort("medium");
  const completion = await createCompletionResilient(openai, {
    model: getModel(),
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
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
    return NextResponse.json(
      { error: "AI 응답을 받지 못했습니다." },
      { status: 502 },
    );
  }
  const aiResult: AssessmentResult = JSON.parse(raw);

  // 결과·사진·선견적 원문 모두 서버에 저장하지 않음(손해사정과 동일). 브라우저 캐시에만 남음.

  const { ip, userAgent } = getRequestMeta(req);
  void logAudit({
    action: AuditAction.ASSESSMENT_SUBMITTED,
    actorUserId: user.id,
    actorEmployeeId: user.employeeId,
    detail: `${vehicle.manufacturer} ${vehicle.model}`,
    ip,
    userAgent,
  });

  return NextResponse.json({ result: aiResult });
}
