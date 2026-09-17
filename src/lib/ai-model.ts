import "server-only";
import { prisma } from "./prisma";
import { DEFAULT_MODEL } from "./pricing-defaults";
import { findModelSpec, isReasoningModel } from "./model-catalog";

// 관리자가 고른 AI 모델. AppSetting("ai-model")에 저장, 없으면 환경변수 AI_MODEL → 기본값.
// Groq(개발용) 키가 있으면 Groq 모델로 강제(관리자 설정 무시).

const KEY = "ai-model";

export interface ModelSetting {
  model: string;
}

export interface ResolvedModel {
  id: string;
  reasoning: boolean; // reasoning.effort 파라미터를 붙일지
  source: "groq" | "setting" | "env" | "default";
}

export async function getModelSetting(): Promise<{
  model: string;
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
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? null,
  };
}

export async function saveModelSetting(model: string, updatedBy: string) {
  const value = { model: model.trim() };
  return prisma.appSetting.upsert({
    where: { key: KEY },
    update: { value, updatedBy },
    create: { key: KEY, value, updatedBy },
  });
}

// 실행 직전에 호출. 도구 route가 이 값을 AiRun.model과 OpenAI 호출 양쪽에 씀.
export async function resolveModel(): Promise<ResolvedModel> {
  if (process.env.GROQ_API_KEY)
    return {
      id: process.env.AI_MODEL ?? "qwen/qwen3-vl-32b-instruct",
      reasoning: false,
      source: "groq",
    };
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  const v = row?.value as Partial<ModelSetting> | null;
  if (typeof v?.model === "string" && v.model.trim()) {
    const id = v.model.trim();
    return { id, reasoning: isReasoningModel(id), source: "setting" };
  }
  if (process.env.AI_MODEL)
    return {
      id: process.env.AI_MODEL,
      reasoning: isReasoningModel(process.env.AI_MODEL),
      source: "env",
    };
  return {
    id: DEFAULT_MODEL,
    reasoning: findModelSpec(DEFAULT_MODEL)?.reasoning ?? true,
    source: "default",
  };
}
