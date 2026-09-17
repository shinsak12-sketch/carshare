// 관리자가 고를 수 있는 모델 목록. prisma·next 의존 없는 순수 상수(seed·클라이언트 공용).
// 단가는 OpenAI 공개 요금표 기준 예측치 — 실제 청구와 다르면 단가 화면에서 수정.
// gpt-5.6-sol만 실제 청구서로 검증됨(2026-09-17, 입력이 캐시 쓰기 단가로 청구).

import { DEFAULT_MODEL, DEFAULT_RATE, type RateLike } from "./pricing-defaults";

export type ModelTier = "top" | "standard" | "economy";

export interface ModelSpec {
  id: string;
  label: string;
  tier: ModelTier;
  // 추론형 모델이면 reasoning.effort를 붙여 호출. 아니면 파라미터 자체를 보내면 400.
  reasoning: boolean;
  rate: RateLike; // USD / 100만 토큰, 환율은 공통
  verified: boolean; // 실제 청구서로 단가 확인 여부
  note: string;
}

const KRW = DEFAULT_RATE.usdToKrw;

export const MODEL_CATALOG: ModelSpec[] = [
  {
    id: DEFAULT_MODEL,
    label: "GPT-5.6 Sol",
    tier: "top",
    reasoning: true,
    rate: { ...DEFAULT_RATE },
    verified: true,
    note: "현재 기본. 사진의 미세 손상(램프 크랙 등) 판독이 가장 정확. 실제 청구서로 단가 확인됨.",
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    tier: "standard",
    reasoning: true,
    rate: {
      inputUsdPerM: 1.25,
      cachedInputUsdPerM: 0.125,
      outputUsdPerM: 10,
      usdToKrw: KRW,
    },
    verified: false,
    note: "추론형. Sol 대비 입력 1/4·출력 1/2 수준. 사진 판독 정밀도는 낮아질 수 있음.",
  },
  {
    id: "gpt-5-mini",
    label: "GPT-5 mini",
    tier: "economy",
    reasoning: true,
    rate: {
      inputUsdPerM: 0.25,
      cachedInputUsdPerM: 0.025,
      outputUsdPerM: 2,
      usdToKrw: KRW,
    },
    verified: false,
    note: "추론형 소형. 비용 약 1/10. 경미 손상·판금 정도 판단이 거칠어질 수 있음.",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    tier: "standard",
    reasoning: false,
    rate: {
      inputUsdPerM: 2,
      cachedInputUsdPerM: 0.5,
      outputUsdPerM: 8,
      usdToKrw: KRW,
    },
    verified: false,
    note: "비추론형. 출력에 추론 토큰이 없어 실제 출력 비용은 더 낮음. 단계적 판단(수리 가능 여부→유형)이 약할 수 있음.",
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    tier: "economy",
    reasoning: false,
    rate: {
      inputUsdPerM: 0.4,
      cachedInputUsdPerM: 0.1,
      outputUsdPerM: 1.6,
      usdToKrw: KRW,
    },
    verified: false,
    note: "비추론형 소형. 가장 저렴. 테스트·대량 1차 스크리닝 용도.",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    tier: "standard",
    reasoning: false,
    rate: {
      inputUsdPerM: 2.5,
      cachedInputUsdPerM: 1.25,
      outputUsdPerM: 10,
      usdToKrw: KRW,
    },
    verified: false,
    note: "비추론형 구세대. GPT-4.1보다 비싸고 성능 이점 없음. 호환 확인용.",
  },
];

export const TIER_LABEL: Record<ModelTier, string> = {
  top: "최상위",
  standard: "표준",
  economy: "경제형",
};

export function findModelSpec(id: string): ModelSpec | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

// 목록에 없는 모델 ID(직접 입력)면 이름으로 추론형 여부를 추정
export function isReasoningModel(id: string): boolean {
  const spec = findModelSpec(id);
  if (spec) return spec.reasoning;
  return /^(gpt-5|o\d)/.test(id);
}

export function defaultRateFor(id: string): RateLike {
  return findModelSpec(id)?.rate ?? DEFAULT_RATE;
}
