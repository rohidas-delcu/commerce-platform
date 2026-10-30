BEGIN;
-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "brandingName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "contactEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "merchantId" UUID,
ADD COLUMN     "onboardingState" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
ADD COLUMN     "settingsVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- CreateTable
CREATE TABLE "MerchantAccount" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "legacySubject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantMembership" (
    "merchantId" UUID NOT NULL,
    "identityId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "MerchantMembership_pkey" PRIMARY KEY ("merchantId","identityId")
);

-- CreateTable
CREATE TABLE "StoreMembership" (
    "storeId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "identityId" UUID NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "StoreMembership_pkey" PRIMARY KEY ("storeId","identityId")
);

-- CreateTable
CREATE TABLE "StoreCreation" (
    "identityId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "merchantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "digest" TEXT NOT NULL,

    CONSTRAINT "StoreCreation_pkey" PRIMARY KEY ("identityId","key")
);

-- CreateTable
CREATE TABLE "MerchantInvitation" (
    "id" UUID NOT NULL,
    "digest" TEXT NOT NULL,
    "merchantId" UUID NOT NULL,
    "storeId" UUID,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "inviterId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "MerchantInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantAccount_legacySubject_key" ON "MerchantAccount"("legacySubject");

-- CreateIndex
CREATE INDEX "MerchantMembership_identityId_idx" ON "MerchantMembership"("identityId");

-- CreateIndex
CREATE INDEX "StoreMembership_merchantId_identityId_idx" ON "StoreMembership"("merchantId", "identityId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreCreation_storeId_key" ON "StoreCreation"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreCreation_storeId_merchantId_key" ON "StoreCreation"("storeId", "merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantInvitation_digest_key" ON "MerchantInvitation"("digest");

-- CreateIndex
CREATE INDEX "MerchantInvitation_merchantId_email_idx" ON "MerchantInvitation"("merchantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Store_id_merchantId_key" ON "Store"("id", "merchantId");

-- Preserve all legacy rows and provenance; quarantine is not a real identity claim.
INSERT INTO "MerchantAccount" (id,name,status,"legacySubject")
SELECT gen_random_uuid(),'Unmapped legacy owner','QUARANTINED',"ownerSubjectId" FROM "Store" GROUP BY "ownerSubjectId";
UPDATE "Store" s SET "merchantId"=m.id FROM "MerchantAccount" m WHERE m."legacySubject"=s."ownerSubjectId";
ALTER TABLE "Store" ALTER COLUMN "merchantId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "MerchantAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantMembership" ADD CONSTRAINT "MerchantMembership_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "MerchantAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantMembership" ADD CONSTRAINT "MerchantMembership_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMembership" ADD CONSTRAINT "StoreMembership_storeId_merchantId_fkey" FOREIGN KEY ("storeId", "merchantId") REFERENCES "Store"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMembership" ADD CONSTRAINT "StoreMembership_merchantId_identityId_fkey" FOREIGN KEY ("merchantId", "identityId") REFERENCES "MerchantMembership"("merchantId", "identityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMembership" ADD CONSTRAINT "StoreMembership_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCreation" ADD CONSTRAINT "StoreCreation_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCreation" ADD CONSTRAINT "StoreCreation_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "MerchantAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCreation" ADD CONSTRAINT "StoreCreation_storeId_merchantId_fkey" FOREIGN KEY ("storeId", "merchantId") REFERENCES "Store"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantInvitation" ADD CONSTRAINT "MerchantInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantInvitation" ADD CONSTRAINT "MerchantInvitation_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "MerchantAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantInvitation" ADD CONSTRAINT "MerchantInvitation_storeId_merchantId_fkey" FOREIGN KEY ("storeId", "merchantId") REFERENCES "Store"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MerchantAccount" ADD CONSTRAINT "MerchantAccount_status_check" CHECK (status IN ('ACTIVE','SUSPENDED','QUARANTINED','RECOVERY_REQUIRED'));
ALTER TABLE "MerchantMembership" ADD CONSTRAINT "MerchantMembership_role_check" CHECK (role IN ('ACCOUNT_OWNER','MEMBER'));
ALTER TABLE "StoreMembership" ADD CONSTRAINT "StoreMembership_role_check" CHECK (role IN ('STORE_ADMIN','STORE_EDITOR','STORE_VIEWER'));
ALTER TABLE "Store" ADD CONSTRAINT "Store_onboarding_check" CHECK ("onboardingState" IN ('IN_PROGRESS','COMPLETED') AND "settingsVersion">=0);
ALTER TABLE "MerchantInvitation" ADD CONSTRAINT "MerchantInvitation_role_check" CHECK (("storeId" IS NULL AND role='MEMBER') OR ("storeId" IS NOT NULL AND role IN ('STORE_ADMIN','STORE_EDITOR','STORE_VIEWER')));

COMMIT;
