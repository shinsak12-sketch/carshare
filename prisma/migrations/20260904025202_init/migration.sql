-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentCase" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "damagedPart" TEXT,
    "memo" TEXT,
    "estimateText" TEXT,
    "aiResult" JSONB NOT NULL,
    "groundTruthVerdict" TEXT,
    "groundTruthMemo" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "promptVersionId" TEXT,

    CONSTRAINT "AssessmentCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentImage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "caseId" TEXT NOT NULL,

    CONSTRAINT "AssessmentImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentCase_createdAt_idx" ON "AssessmentCase"("createdAt");

-- CreateIndex
CREATE INDEX "AssessmentImage_caseId_idx" ON "AssessmentImage"("caseId");

-- AddForeignKey
ALTER TABLE "AssessmentCase" ADD CONSTRAINT "AssessmentCase_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentImage" ADD CONSTRAINT "AssessmentImage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AssessmentCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

