-- 구버전 진단 이력 폐쇄 (결과 본문을 DB에 남기지 않는 정책, 직원 오픈 전 초기화)
DROP TABLE IF EXISTS "AssessmentCase";
DROP TABLE IF EXISTS "PromptVersion";

-- CreateTable
CREATE TABLE "AiRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "userId" TEXT,
    "employeeId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "jobId" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "blockedReason" TEXT,
    "photoCount" INTEGER NOT NULL DEFAULT 0,
    "estimateAmount" INTEGER,
    "plateNo" TEXT,
    "claimNo" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "reasoningTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION,
    "costKrw" INTEGER,
    "rateSnapshot" JSONB,
    "durationMs" INTEGER,
    "verdictCounts" JSONB,

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "model" TEXT NOT NULL,
    "inputUsdPerM" DOUBLE PRECISION NOT NULL,
    "cachedInputUsdPerM" DOUBLE PRECISION NOT NULL,
    "outputUsdPerM" DOUBLE PRECISION NOT NULL,
    "usdToKrw" DOUBLE PRECISION NOT NULL,
    "note" TEXT,

    CONSTRAINT "PricingRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiRun_jobId_key" ON "AiRun"("jobId");
CREATE INDEX "AiRun_createdAt_idx" ON "AiRun"("createdAt");
CREATE INDEX "AiRun_userId_createdAt_idx" ON "AiRun"("userId", "createdAt");
CREATE INDEX "AiRun_tool_createdAt_idx" ON "AiRun"("tool", "createdAt");
CREATE INDEX "AiRun_plateNo_idx" ON "AiRun"("plateNo");
CREATE INDEX "AiRun_status_idx" ON "AiRun"("status");
CREATE INDEX "PricingRate_model_effectiveFrom_idx" ON "PricingRate"("model", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
