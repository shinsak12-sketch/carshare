import "server-only";
import { prisma } from "./prisma";
import { DEFAULT_MODEL } from "./pricing-defaults";
import { findModelSpec, isReasoningModel } from "./model-catalog";
import { isOutputDetail, type OutputDetail } from "./output-mode";
import {
  isStrictness,
  type AdjustmentStrictness,
} from "./adjustment-strictness";

// 관리자가 고른 AI 모델. AppSetting("ai-model")에 저장, 없으면 환경변수 AI_MODEL → 기본값.
// Groq(개발용) 키가 있으면 Groq 모델로 강제(관리자 설정 무시).

const KEY = "ai-model";

export interface ModelSetting {
  model: string;
  detail: OutputDetail; // 출력 상세도(상세/간략)
  strictness: AdjustmentStrictness; // 손해사정 강도(1 관대 / 2 표준 / 3 엄격)
}

export interface ResolvedModel {
  id: string;
  reasoning: boolean; // reasoning.effort 파라미터를 붙일지
  detail: OutputDetail;
  strictness: AdjustmentStrictness;
  source: "groq" | "setting" | "env" | "default";
}

function detailOf(v: Partial<ModelSetting> | null | undefined): OutputDetail {
  return isOutputDetail(v?.detail) ? v.detail : "detailed";
}
function strictnessOf(
  v: Partial<ModelSetting> | null | undefined,
): AdjustmentStrictness {
  return isStrictness(v?.strictness) ? v.strictness : 3;
}

export async function getModelSetting(): Promise<{
  model: string;
  detail: OutputDetail;
  strictness: AdjustmentStrictness;
  updatedAt: Date | null;
  updatedBy: string | null;
}> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  const v = row?.value as Partial<ModelSetting> | null;
  const model =
    typeof v?.model === "string" && v.model.trim()
      ? v.model.trim()
      : (process.env.AI_MODEL ?? DEFAULT_MODEL);
  return {
    model,
    detail: detailOf(v),
    strictness: strictnessOf(v),
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? null,
  };
}

export async function saveModelSetting(
  setting: ModelSetting,
  updatedBy: string,
) {
  const value = {
    model: setting.model.trim(),
    detail: setting.detail,
    strictness: setting.strictness,
  };
  return prisma.appSetting.upsert({
    where: { key: KEY },
    update: { value, updatedBy },
    create: { key: KEY, value, updatedBy },
  });
}

// 실행 직전에 호출. 도구 route가 이 값을 AiRun.model과 OpenAI 호출 양쪽에 씀.
export async function resolveModel(): Promise<ResolvedModel> {
  const row = process.env.GROQ_API_KEY
    ? null
    : await prisma.appSetting.findUnique({ where: { key: KEY } });
  const v = row?.value as Partial<ModelSetting> | null;
  const detail = detailOf(v);
  const strictness = strictnessOf(v);
  if (process.env.GROQ_API_KEY)
    return {
      id: process.env.AI_MODEL ?? "qwen/qwen3-vl-32b-instruct",
      reasoning: false,
      detail,
      strictness,
      source: "groq",
    };
  if (typeof v?.model === "string" && v.model.trim()) {
    const id = v.model.trim();
    return {
      id,
      reasoning: isReasoningModel(id),
      detail,
      strictness,
      source: "setting",
    };
  }
  if (process.env.AI_MODEL)
    return {
      id: process.env.AI_MODEL,
      reasoning: isReasoningModel(process.env.AI_MODEL),
      detail,
      strictness,
      source: "env",
    };
  return {
    id: DEFAULT_MODEL,
    reasoning: findModelSpec(DEFAULT_MODEL)?.reasoning ?? true,
    detail,
    strictness,
    source: "default",
  };
}
