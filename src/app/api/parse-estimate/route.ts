import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getModel, getOpenAI } from "@/lib/openai";
import { isPdfFile, extractEstimateText } from "@/lib/estimate-pdf";
import { ESTIMATE_PARSE_PROMPT, ESTIMATE_PARSE_SCHEMA, type ParsedEstimateInfo } from "@/lib/estimate-parse";

export const runtime = "nodejs";

const EMPTY_RESULT: ParsedEstimateInfo = {
  claimNumber: null,
  manufacturer: null,
  model: null,
  year: null,
};

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("estimate");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "선견적 파일이 없습니다." }, { status: 400 });
    }
    if (!isPdfFile(file)) {
      return NextResponse.json({ error: "선견적은 PDF 파일만 첨부 가능합니다." }, { status: 400 });
    }

    const estimateText = await extractEstimateText(file);
    if (!estimateText.trim()) {
      return NextResponse.json(EMPTY_RESULT);
    }

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: getModel(),
      temperature: 0,
      messages: [
        { role: "system", content: ESTIMATE_PARSE_PROMPT },
        { role: "user", content: estimateText },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "estimate_info", schema: ESTIMATE_PARSE_SCHEMA, strict: true },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    const parsed: ParsedEstimateInfo = raw ? JSON.parse(raw) : EMPTY_RESULT;
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/parse-estimate] failed:", err);
    // 자동입력은 편의 기능이라 실패해도 폼 자체는 계속 쓸 수 있어야 함 — 빈 값 반환
    return NextResponse.json(EMPTY_RESULT);
  }
}
