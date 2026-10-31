-- CreateTable
CREATE TABLE "Identity" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentitySession" (
    "id" UUID NOT NULL,
    "identityId" UUID,
    "csrfDigest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentitySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentitySessionSecret" (
    "csrfDigest" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "sessionId" UUID NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "IdentitySessionSecret_pkey" PRIMARY KEY ("digest")
);

-- CreateTable
CREATE TABLE "IdentityChallenge" (
    "digest" TEXT NOT NULL,
    "identityId" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "IdentityChallenge_pkey" PRIMARY KEY ("digest")
);

-- CreateTable
CREATE TABLE "IdentityMail" (
    "id" UUID NOT NULL,
    "recipient" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "IdentityMail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityAudit" (
    "id" UUID NOT NULL,
    "identityId" UUID,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityThrottle" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityThrottle_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Identity_email_key" ON "Identity"("email");

-- CreateIndex
CREATE INDEX "IdentitySession_identityId_idx" ON "IdentitySession"("identityId");

-- CreateIndex
CREATE INDEX "IdentitySession_expiresAt_idx" ON "IdentitySession"("expiresAt");

-- CreateIndex
CREATE INDEX "IdentityChallenge_identityId_purpose_idx" ON "IdentityChallenge"("identityId", "purpose");

-- CreateIndex
CREATE INDEX "IdentityChallenge_expiresAt_idx" ON "IdentityChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "IdentityMail_createdAt_idx" ON "IdentityMail"("createdAt");

-- CreateIndex
CREATE INDEX "IdentityAudit_identityId_createdAt_idx" ON "IdentityAudit"("identityId", "createdAt");

-- CreateIndex
CREATE INDEX "IdentityThrottle_expiresAt_idx" ON "IdentityThrottle"("expiresAt");

-- AddForeignKey
ALTER TABLE "IdentitySession" ADD CONSTRAINT "IdentitySession_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentitySessionSecret" ADD CONSTRAINT "IdentitySessionSecret_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "IdentitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityChallenge" ADD CONSTRAINT "IdentityChallenge_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
