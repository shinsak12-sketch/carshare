-- AlterTable
ALTER TABLE "AssessmentCase" ADD COLUMN     "claimNumber" TEXT;

-- CreateIndex
CREATE INDEX "AssessmentCase_claimNumber_idx" ON "AssessmentCase"("claimNumber");

