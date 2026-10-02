-- 보안 강화: 비밀번호 변경 강제, TOTP 2단계 인증, IP 기준 로그인 차단용 인덱스
ALTER TABLE "User"
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN "totpSecret" TEXT,
  ADD COLUMN "totpPendingSecret" TEXT,
  ADD COLUMN "totpEnabledAt" TIMESTAMP(3),
  ADD COLUMN "totpRecoveryHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Session"
  ADD COLUMN "pendingTotp" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "AuditLog_ip_createdAt_idx" ON "AuditLog"("ip", "createdAt");
