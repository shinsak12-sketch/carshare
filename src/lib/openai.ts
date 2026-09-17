import OpenAI from "openai";

let client: OpenAI | null = null;

// 개발 중엔 OpenAI 크레딧을 안 쓰려고 Groq(무료 티어, OpenAI 호환 API)로
// 테스트하고, 나중에 OPENAI_API_KEY만 넣으면 관리자가 고른 OpenAI 모델로 돌아감.
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
      client = new OpenAI({ apiKey: openaiKey, maxRetries: 0 });
    } else {
      throw new Error(
        "GROQ_API_KEY 또는 OPENAI_API_KEY 환경변수가 설정되지 않았습니다.",
      );
    }
  }
  return client;
}

// 모델 선택과 reasoning.effort 부착 여부는 ai-model.ts(관리자 설정)와 ai-job.ts가 결정한다.

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

// 세 도구 공통 호출. Vercel 함수 제한(300초) 안에서 끝나도록 전체 시간 예산을 잡고,
// 5xx·타임아웃·네트워크 오류면 남은 예산이 충분할 때만 같은 조건으로 한 번 더 시도.
// 추론 강도는 절대 낮추지 않음(담당자 지시). 예산을 넘기면 Vercel이 504를 내기 전에
// 우리가 먼저 사용자에게 설명 가능한 오류를 돌려줌.
const TOTAL_BUDGET_MS = 270_000;
const ATTEMPT_MAX_MS = 200_000;
const RETRY_MIN_REMAINING_MS = 60_000;

export async function createCompletionResilient(
  openai: OpenAI,
  params: ChatParams,
) {
  const started = Date.now();
  const remaining = () => TOTAL_BUDGET_MS - (Date.now() - started);
  let attempt = 0;
  for (;;) {
    attempt++;
    const timeout = Math.min(ATTEMPT_MAX_MS, remaining() - 5_000);
    if (timeout < 20_000) {
      throw new Error(
        "AI 응답 시간이 초과됐습니다. 사진 수를 줄이거나 잠시 후 다시 시도해주세요.",
      );
    }
    try {
      return await openai.chat.completions.create(params, {
        timeout,
        maxRetries: 0,
      });
    } catch (err) {
      const d = describeError(err);
      console.error(
        `[ai] attempt ${attempt} failed after ${Date.now() - started}ms:`,
        d,
      );
      const retryable =
        d.status === undefined ||
        d.status >= 500 ||
        d.status === 408 ||
        d.status === 429;
      if (retryable && attempt < 2 && remaining() > RETRY_MIN_REMAINING_MS) {
        console.warn("[ai] retrying once with the same parameters");
        continue;
      }
      throw toUserError(err);
    }
  }
}
