import { NextRequest, NextResponse } from "next/server";
import {
  createCompletionResilient,
  getModel,
  getOpenAI,
  getReasoningEffort,
} from "@/lib/openai";
import { getCurrentUser } from "@/lib/session";
import { isPdfFile, extractEstimateText } from "@/lib/estimate-pdf";
import { redactPersonalInfo } from "@/lib/pii-redact";
import {
  ESTIMATE_TREE_PROMPT,
  ESTIMATE_TREE_SCHEMA,
  type EstimateTree,
} from "@/lib/estimate-tree";

export const runtime = "nodejs";
export const maxDuration = 120;

// [실험] 견적서 PDF → 부위별 트리(JSON). 텍스트만 보내는 가벼운 호출(사진 없음).
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );

    const form = await req.formData();
    const file = form.get("estimate");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "견적서 파일이 없습니다." },
        { status: 400 },
      );
    }
    if (!isPdfFile(file)) {
      return NextResponse.json(
        { error: "견적서는 PDF 파일만 첨부 가능합니다." },
        { status: 400 },
      );
    }

    const rawText = await extractEstimateText(file);
    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "견적서에서 텍스트를 읽지 못했습니다(스캔본이면 인식 불가)." },
        { status: 422 },
      );
    }
    const text = redactPersonalInfo(rawText);

    const openai = getOpenAI();
    const effort = getReasoningEffort("low");
    const completion = await createCompletionResilient(openai, {
      model: getModel(),
      ...(effort ? { reasoning_effort: effort } : {}),
      messages: [
        { role: "system", content: ESTIMATE_TREE_PROMPT },
        { role: "user", content: `[청구 견적서 원문 텍스트]\n${text}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "estimate_tree",
          schema: ESTIMATE_TREE_SCHEMA,
          strict: true,
        },
      },
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw)
      return NextResponse.json(
        { error: "AI 응답을 받지 못했습니다." },
        { status: 502 },
      );
    const tree: EstimateTree = JSON.parse(raw);
    return NextResponse.json({ tree });
  } catch (err) {
    console.error("[/api/estimate-tree] failed:", err);
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
