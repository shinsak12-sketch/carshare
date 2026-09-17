// 단가 초기값(예측치). 실제 값은 DB(PricingRate)에서 관리자가 수정.
// seed와 서버 양쪽에서 쓰므로 prisma·next 의존 없이 순수 상수만.
export const DEFAULT_MODEL = "gpt-5.6-sol";

// 2026-09-17 OpenAI 사용량 화면으로 확인: 입력 87.4k는 "cache writes" $0.44(= $5.0/M),
// 출력 11.4k(추론 포함)는 $0.23(= $20/M). 이 모델은 입력이 캐시 쓰기 단가로 청구되므로
// 입력 단가 = 캐시 쓰기 단가로 둔다. 캐시 읽기(cached_tokens)는 쓰기의 1/10로 추정 — 검증 전.
export const DEFAULT_RATE = {
  inputUsdPerM: 5.0, // 입력(캐시 쓰기) 100만 토큰당 USD
  cachedInputUsdPerM: 0.5, // 캐시된 입력(읽기) — 추정
  outputUsdPerM: 20, // 출력(추론 토큰 포함)
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
