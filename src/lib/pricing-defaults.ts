// 단가 초기값(예측치). 실제 값은 DB(PricingRate)에서 관리자가 수정.
// seed와 서버 양쪽에서 쓰므로 prisma·next 의존 없이 순수 상수만.
export const DEFAULT_MODEL = "gpt-6.1-sol";

// GPT-6.1 Sol 공개 요금표(2026-10): 입력 $2.0/M, 캐시 읽기 $0.1/M, 출력 $10/M(추론 토큰 포함),
// 캐시 쓰기 $2.5/M. 이전 기본 GPT-5.6 Sol은 백그라운드 실행(store) 때문에 입력 전체가
// "캐시 쓰기" 단가로 청구됐으므로(2026-09-17 청구서), 같은 방식이면 입력은 $2.5/M로 잡힘.
// 보수적으로 입력 = 캐시 쓰기 단가로 둔다. 첫 청구서로 확인 후 단가 화면에서 수정.
export const DEFAULT_RATE = {
  inputUsdPerM: 2.5, // 입력(캐시 쓰기 기준) 100만 토큰당 USD
  cachedInputUsdPerM: 0.1, // 캐시된 입력(읽기)
  outputUsdPerM: 10, // 출력(추론 토큰 포함)
  usdToKrw: 1400,
};

export interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
}

export interface RateLike {
  inputUsdPerM: number;
  cachedInputUsdPerM: number;
  outputUsdPerM: number;
  usdToKrw: number;
}

// OpenAI 과금 방식: 캐시된 입력은 캐시 단가, 나머지 입력은 일반 단가, 출력 토큰에는 추론 토큰이 포함됨.
export function computeCost(u: TokenUsage, r: RateLike) {
  const uncached = Math.max(0, u.inputTokens - u.cachedInputTokens);
  const usd =
    (uncached * r.inputUsdPerM +
      u.cachedInputTokens * r.cachedInputUsdPerM +
      u.outputTokens * r.outputUsdPerM) /
    1_000_000;
  return { costUsd: usd, costKrw: Math.round(usd * r.usdToKrw) };
}
