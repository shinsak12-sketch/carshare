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
  // gpt-5.6-sol: 현재 OpenAI 최상위 비전 모델. 사진의 미세한 손상(예: 램프
  // 렌즈 크랙)을 놓치는 문제는 프롬프트로 강제할 수 있는 한계를 넘어선
  // 시각 인식 자체의 문제라 판단해 모델을 올림. 필요하면 AI_MODEL 환경변수로
  // 언제든 다른 모델로 덮어쓸 수 있음.
  return process.env.GROQ_API_KEY ? "qwen/qwen3-vl-32b-instruct" : "gpt-5.6-sol";
}
