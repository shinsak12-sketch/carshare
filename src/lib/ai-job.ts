import type OpenAI from "openai";
import { getOpenAI } from "./openai";
import type { ResolvedModel } from "./ai-model";
import type { TokenUsage } from "./pricing-defaults";

// AI 판단을 OpenAI 백그라운드 작업으로 던지고 작업 ID만 돌려준다.
// Vercel 함수는 GPT 응답을 기다리지 않으므로 제한시간(300초)과 무관하고,
// 토큰을 쓴 결과는 OpenAI 쪽에 완성돼 있어 새로고침·재접속 후에도 이어받을 수 있다.
// 결과를 가져온 뒤엔 OpenAI 서버의 저장본을 삭제(사진·견적서 텍스트 보관 최소화).

export interface StructuredJobInput {
  system: string;
  userText: string;
  imageUrls: string[];
  schemaName: string;
  schema: Record<string, unknown>;
  effort: "low" | "medium";
  model: ResolvedModel; // 관리자 설정에서 resolveModel()로 얻은 값
}

export type JobStart =
  | { jobId: string }
  | { result: unknown; usage: TokenUsage };

// OpenAI Responses / Chat 응답의 usage를 공통 형태로
export function usageOf(u: unknown): TokenUsage {
  const x = u as
    | {
        input_tokens?: number;
        output_tokens?: number;
        input_tokens_details?: { cached_tokens?: number };
        output_tokens_details?: { reasoning_tokens?: number };
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
        completion_tokens_details?: { reasoning_tokens?: number };
      }
    | null
    | undefined;
  return {
    inputTokens: x?.input_tokens ?? x?.prompt_tokens ?? 0,
    cachedInputTokens:
      x?.input_tokens_details?.cached_tokens ??
      x?.prompt_tokens_details?.cached_tokens ??
      0,
    outputTokens: x?.output_tokens ?? x?.completion_tokens ?? 0,
    reasoningTokens:
      x?.output_tokens_details?.reasoning_tokens ??
      x?.completion_tokens_details?.reasoning_tokens ??
      0,
  };
}

function describe(err: unknown): string {
  const e = err as {
    status?: number;
    requestID?: string;
    message?: string;
    error?: { message?: string };
  };
  const status = typeof e?.status === "number" ? e.status : undefined;
  const rid = e?.requestID ? ` (요청 ID ${e.requestID})` : "";
  const msg = e?.error?.message ?? e?.message ?? String(err);
  if (status === 429 && /insufficient_quota|billing|credit/i.test(msg))
    return `OpenAI 크레딧이 부족합니다. 결제/충전 후 다시 시도해주세요.${rid}`;
  if (status === 429)
    return `AI 서버 사용량 제한(429)입니다. 잠시 후 다시 시도해주세요.${rid}`;
  if (status && status >= 500)
    return `AI 서버(OpenAI) 일시 오류(${status})입니다. 잠시 후 다시 시도해주세요.${rid}`;
  if (status === 400) return `AI 요청이 거부됐습니다(400): ${msg}${rid}`;
  return `${msg}${rid}`;
}

export async function startStructuredJob(
  input: StructuredJobInput,
): Promise<JobStart> {
  const openai = getOpenAI();
  // 추론형 모델만 reasoning.effort를 보냄(비추론형·Groq 모델은 파라미터를 모르면 400).
  // 추론 강도는 절대 낮추지 않음(담당자 지시).
  const effort = input.model.reasoning ? input.effort : undefined;

  // Groq(개발용)은 백그라운드 모드가 없어 동기 호출로 바로 결과 반환
  if (process.env.GROQ_API_KEY) {
    const completion = await openai.chat.completions.create({
      model: input.model.id,
      messages: [
        { role: "system", content: input.system },
        {
          role: "user",
          content: [
            { type: "text", text: input.userText },
            ...input.imageUrls.map((url) => ({
              type: "image_url" as const,
              image_url: { url },
            })),
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: input.schemaName,
          schema: input.schema,
          strict: true,
        },
      },
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("AI 응답을 받지 못했습니다.");
    return { result: JSON.parse(raw), usage: usageOf(completion.usage) };
  }

  try {
    const resp = await openai.responses.create(
      {
        model: input.model.id,
        instructions: input.system,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: input.userText },
              ...input.imageUrls.map((url) => ({
                type: "input_image" as const,
                image_url: url,
                detail: "auto" as const,
              })),
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: input.schemaName,
            schema: input.schema,
            strict: true,
          },
        },
        ...(effort ? { reasoning: { effort } } : {}),
        background: true,
        store: true,
      },
      { maxRetries: 2, timeout: 60_000 },
    );
    return { jobId: resp.id };
  } catch (err) {
    console.error("[ai-job] start failed:", err);
    throw new Error(describe(err));
  }
}

export type JobStatus =
  | { status: "queued" | "in_progress" }
  | { status: "completed"; result: unknown; usage: TokenUsage }
  | { status: "failed"; error: string; usage: TokenUsage };

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const openai = getOpenAI();
  let resp: OpenAI.Responses.Response;
  try {
    resp = await openai.responses.retrieve(
      jobId,
      {},
      { maxRetries: 2, timeout: 30_000 },
    );
  } catch (err) {
    console.error("[ai-job] retrieve failed:", err);
    throw new Error(describe(err));
  }
  if (resp.status === "queued" || resp.status === "in_progress")
    return { status: resp.status };
  if (resp.status === "completed") {
    const raw = resp.output_text;
    // 결과를 받았으니 OpenAI 서버의 저장본은 지움(사진·견적서 보관 최소화). 실패해도 결과엔 영향 없음
    void openai.responses
      .delete(jobId)
      .catch((e) => console.warn("[ai-job] delete failed:", e));
    const usage = usageOf(resp.usage);
    if (!raw)
      return { status: "failed", error: "AI 응답이 비어 있습니다.", usage };
    try {
      return { status: "completed", result: JSON.parse(raw), usage };
    } catch {
      return {
        status: "failed",
        error: "AI 응답을 해석하지 못했습니다.",
        usage,
      };
    }
  }
  const reason =
    resp.error?.message ??
    (resp.incomplete_details?.reason
      ? `응답 미완료(${resp.incomplete_details.reason})`
      : `상태: ${resp.status}`);
  void openai.responses.delete(jobId).catch(() => undefined);
  return {
    status: "failed",
    error: `AI 판단 실패 — ${reason}`,
    usage: usageOf(resp.usage),
  };
}
