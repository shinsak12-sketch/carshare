import OpenAI from "openai";

let client: OpenAI | null = null;

// 개발 중엔 OpenAI 크레딧을 안 쓰려고 Groq(무료 티어, OpenAI 호환 API)로
// 테스트하고, 나중에 OPENAI_API_KEY만 넣으면 자동으로 GPT-5.6 Sol로 돌아감.
// 우선순위: GROQ_API_KEY가 있으면 Groq, 없으면 OPENAI_API_KEY로 OpenAI.
export function getOpenAI() {
  if (!client) {
    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (groqKey) {
      client = new OpenAI({
        apiKey: groqKey,
        baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
      });
    } else if (openaiKey) {
      // 5xx·429·네트워크 오류는 SDK가 자동 재시도(3회). 사진 많은 건은 응답이 길어 타임아웃 여유.
      client = new OpenAI({
        apiKey: openaiKey,
        maxRetries: 3,
        timeout: 240_000,
      });
    } else {
      throw new Error(
        "GROQ_API_KEY 또는 OPENAI_API_KEY 환경변수가 설정되지 않았습니다.",
      );
    }
  }
  return client;
}

export function getModel() {
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  // gpt-5.6-sol: 현재 OpenAI 최상위 비전 모델. 사진의 미세한 손상(예: 램프
  // 렌즈 크랙)을 놓치는 문제는 프롬프트로 강제할 수 있는 한계를 넘어선
  // 시각 인식 자체의 문제라 판단해 모델을 올림. 필요하면 AI_MODEL 환경변수로
  // 언제든 다른 모델로 덮어쓸 수 있음.
  return process.env.GROQ_API_KEY
    ? "qwen/qwen3-vl-32b-instruct"
    : "gpt-5.6-sol";
}

// gpt-5.6-sol 같은 추론형 모델은 reasoning.effort 기본값(medium)만으로도
// Vercel 서버리스 함수 제한시간(맥스 60초 근처)을 넘겨 타임아웃(504)이 나서
// 낮춰서 씀. Groq(qwen3-vl)는 이 파라미터 자체를 모르는 다른 모델이라
// 붙이면 오류가 나므로, OpenAI를 쓸 때만 반환하고 아니면 undefined.
export function getReasoningEffort(
  effort: "none" | "low" | "medium",
): "none" | "low" | "medium" | undefined {
  if (process.env.GROQ_API_KEY) return undefined;
  return effort;
}

type ChatParams =
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

function describeError(err: unknown): {
  status?: number;
  requestID?: string;
  message: string;
} {
  const e = err as {
    status?: number;
    requestID?: string;
    request_id?: string;
    message?: string;
  };
  return {
    status: typeof e?.status === "number" ? e.status : undefined,
    requestID: e?.requestID ?? e?.request_id,
    message: e?.message ?? String(err),
  };
}

function toUserError(err: unknown): Error {
  const { status, requestID, message } = describeError(err);
  const rid = requestID ? ` (요청 ID ${requestID})` : "";
  if (status && status >= 500)
    return new Error(
      `AI 서버(OpenAI) 일시 오류(${status})입니다. 잠시 후 다시 시도해주세요.${rid}`,
    );
  if (status === 429 && /insufficient_quota|billing|credit/i.test(message))
    return new Error(
      `OpenAI 크레딧이 부족합니다. 결제/충전 후 다시 시도해주세요.${rid}`,
    );
  if (status === 429)
    return new Error(
      `AI 서버 사용량 제한(429)입니다. 잠시 후 다시 시도해주세요.${rid}`,
    );
  if (status === 400)
    return new Error(`AI 요청이 거부됐습니다(400): ${message}${rid}`);
  if (status === 408 || /timeout|timed out/i.test(message))
    return new Error(
      `AI 응답 시간이 초과됐습니다. 사진 수를 줄이거나 잠시 후 다시 시도해주세요.${rid}`,
    );
  return err instanceof Error ? err : new Error(message);
}

// 세 도구 공통 호출. SDK 재시도까지 실패한 5xx/타임아웃이면 같은 조건으로 한 번 더 시도.
// 추론 강도는 절대 낮추지 않음 — 판단 품질이 곧 결과라서(담당자 지시).
export async function createCompletionResilient(
  openai: OpenAI,
  params: ChatParams,
) {
  try {
    return await openai.chat.completions.create(params);
  } catch (err) {
    const d = describeError(err);
    console.error("[ai] completion failed:", d);
    const retryable =
      d.status === undefined || d.status >= 500 || d.status === 408;
    if (retryable) {
      console.warn("[ai] retrying once with the same parameters");
      try {
        return await openai.chat.completions.create(params);
      } catch (err2) {
        console.error("[ai] retry failed:", describeError(err2));
        throw toUserError(err2);
      }
    }
    throw toUserError(err);
  }
}
