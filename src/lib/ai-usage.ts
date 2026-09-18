import "server-only";
import { prisma } from "./prisma";
import {
  DEFAULT_MODEL,
  computeCost,
  type RateLike,
  type TokenUsage,
} from "./pricing-defaults";
import type { EstimateTree } from "./estimate-tree";
import { defaultRateFor } from "./model-catalog";

// AI 실행 기록(AiRun). 각 도구 API가 시작 시 queued로 만들고, /api/ai-job이 완료를
// 확인할 때 usage를 넣어 확정한다. 결과 본문은 저장하지 않고 판정 집계 숫자만.

export type AiTool = "assess" | "adjustment" | "procedure";

export const TOOL_LABEL: Record<AiTool, string> = {
  assess: "선견적진단",
  adjustment: "AI손해사정",
  procedure: "정비공정",
};

export const ZERO_USAGE: TokenUsage = {
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
};

// 모델의 현재 단가(effectiveFrom이 지금 이전인 것 중 최신). 없으면 카탈로그 예측치.
export async function getActiveRate(
  model: string,
): Promise<RateLike & { id: string | null }> {
  const row = await prisma.pricingRate.findFirst({
    where: { model, effectiveFrom: { lte: new Date() } },
    orderBy: { effectiveFrom: "desc" },
  });
  if (row)
    return {
      id: row.id,
      inputUsdPerM: row.inputUsdPerM,
      cachedInputUsdPerM: row.cachedInputUsdPerM,
      outputUsdPerM: row.outputUsdPerM,
      usdToKrw: row.usdToKrw,
    };
  return { id: null, ...defaultRateFor(model) };
}

export interface RunStart {
  user: { id: string; employeeId: string };
  tool: AiTool;
  promptVersion: string;
  model?: string;
  photoCount: number;
  estimateAmount?: number | null;
  plateNo?: string | null;
  claimNo?: string | null;
}

export async function createRun(input: RunStart) {
  return prisma.aiRun.create({
    data: {
      userId: input.user.id,
      employeeId: input.user.employeeId,
      tool: input.tool,
      promptVersion: input.promptVersion,
      model: input.model ?? DEFAULT_MODEL,
      status: "queued",
      photoCount: input.photoCount,
      estimateAmount: input.estimateAmount ?? null,
      plateNo: input.plateNo || null,
      claimNo: input.claimNo || null,
    },
    select: { id: true, createdAt: true },
  });
}

// 정책에 걸려 실행 자체를 막은 경우도 한 줄 남긴다(토큰 0). 2단계 정책 화면의 차단 통계용.
export async function recordBlockedRun(input: RunStart, reason: string) {
  return prisma.aiRun.create({
    data: {
      userId: input.user.id,
      employeeId: input.user.employeeId,
      tool: input.tool,
      promptVersion: input.promptVersion,
      model: input.model ?? DEFAULT_MODEL,
      status: "blocked",
      blockedReason: reason,
      finishedAt: new Date(),
      photoCount: input.photoCount,
      estimateAmount: input.estimateAmount ?? null,
      plateNo: input.plateNo || null,
      claimNo: input.claimNo || null,
    },
    select: { id: true },
  });
}

export async function getRunByJob(jobId: string) {
  return prisma.aiRun.findUnique({
    where: { jobId },
    select: { id: true, status: true },
  });
}

export async function attachJob(runId: string, jobId: string) {
  await prisma.aiRun.update({ where: { id: runId }, data: { jobId } });
}

async function finalize(
  where: { id: string } | { jobId: string },
  status: "succeeded" | "failed",
  usage: TokenUsage,
  extra: {
    errorMessage?: string;
    verdictCounts?: Record<string, number> | null;
  },
) {
  const run = await prisma.aiRun.findUnique({ where });
  if (!run || run.status === "succeeded" || run.status === "failed") return run;
  const rate = await getActiveRate(run.model);
  const { costUsd, costKrw } = computeCost(usage, rate);
  const now = new Date();
  return prisma.aiRun.update({
    where: { id: run.id },
    data: {
      status,
      finishedAt: now,
      durationMs: now.getTime() - run.createdAt.getTime(),
      inputTokens: usage.inputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      outputTokens: usage.outputTokens,
      reasoningTokens: usage.reasoningTokens,
      costUsd,
      costKrw,
      rateSnapshot: { ...rate },
      errorMessage: extra.errorMessage ?? null,
      verdictCounts: extra.verdictCounts ?? undefined,
    },
  });
}

export function completeRun(runId: string, usage: TokenUsage, result: unknown) {
  return finalize({ id: runId }, "succeeded", usage, {
    verdictCounts: verdictCountsOf(result),
  });
}
export function failRun(
  runId: string,
  message: string,
  usage: TokenUsage = ZERO_USAGE,
) {
  return finalize({ id: runId }, "failed", usage, {
    errorMessage: message.slice(0, 500),
  });
}
export function completeRunByJob(
  jobId: string,
  usage: TokenUsage,
  result: unknown,
) {
  return finalize({ jobId }, "succeeded", usage, {
    verdictCounts: verdictCountsOf(result),
  });
}
export function failRunByJob(
  jobId: string,
  message: string,
  usage: TokenUsage = ZERO_USAGE,
) {
  return finalize({ jobId }, "failed", usage, {
    errorMessage: message.slice(0, 500),
  });
}

// 결과 JSON에서 verdict 분포만 집계(손해사정 items / 선견적 parts). 본문은 버림.
export function verdictCountsOf(
  result: unknown,
): Record<string, number> | null {
  const r = result as {
    items?: { verdict?: string }[];
    parts?: { verdict?: string }[];
  } | null;
  const list = r?.items ?? r?.parts;
  if (!Array.isArray(list)) return null;
  const counts: Record<string, number> = {};
  for (const it of list) {
    const v = typeof it?.verdict === "string" ? it.verdict : "기타";
    counts[v] = (counts[v] ?? 0) + 1;
  }
  return counts;
}

// 견적서 청구 규모 = 사정전 공임 + 부품·재료 합계(부가세 전). 2단계 금액 제한의 입력값.
export function estimateAmountOf(tree: EstimateTree): number {
  let sum = 0;
  for (const r of tree.rows)
    sum += (r.before.labor ?? 0) + (r.before.part ?? 0);
  return Math.round(sum);
}

// 견적서 원문에서 차량번호·접수번호 추출(개인정보 아님, 중복 실행 감지 키).
const PLATE_RE = /\b(\d{2,3}[가-힣]\s?\d{4})\b/;
const CLAIM_RE = /접\s*수\s*번\s*호[^0-9]{0,10}(\d{10,14})/;
export function extractPlateNo(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(PLATE_RE);
  return m ? m[1].replace(/\s+/g, "") : null;
}
export function extractClaimNo(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(CLAIM_RE);
  return m ? m[1] : null;
}
export function normalizePlate(
  input: string | null | undefined,
): string | null {
  const s = (input ?? "").replace(/\s+/g, "").trim();
  return s ? s : null;
}
