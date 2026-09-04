import OpenAI from "openai";

let client: OpenAI | null = null;

// 개발 중엔 OpenAI 크레딧을 안 쓰려고 Groq(무료 티어, OpenAI 호환 API)로
// 테스트하고, 나중에 OPENAI_API_KEY만 넣으면 자동으로 GPT-4o로 돌아감.
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
      client = new OpenAI({ apiKey: openaiKey });
    } else {
      throw new Error(
        "GROQ_API_KEY 또는 OPENAI_API_KEY 환경변수가 설정되지 않았습니다."
      );
    }
  }
  return client;
}

export function getModel() {
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  return process.env.GROQ_API_KEY ? "qwen/qwen3-vl-32b-instruct" : "gpt-4o";
}
