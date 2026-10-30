BEGIN;
-- AlterTable
ALTER TABLE "IdentityMail" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastErrorCode" TEXT,
ADD COLUMN     "leaseToken" UUID,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerMessageId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "OrderNotification" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "leaseToken" UUID,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerMessageId" TEXT;

-- CreateTable
CREATE TABLE "NotificationAttempt" (
    "id" UUID NOT NULL,
    "identityMailId" UUID,
    "identityScopeKey" TEXT,
    "orderNotificationId" UUID,
    "storeId" UUID,
    "leaseToken" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENDING',
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "NotificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationAttempt_leaseToken_key" ON "NotificationAttempt"("leaseToken");

-- CreateIndex
CREATE INDEX "NotificationAttempt_identityMailId_idx" ON "NotificationAttempt"("identityMailId");

-- CreateIndex
CREATE INDEX "NotificationAttempt_orderNotificationId_storeId_idx" ON "NotificationAttempt"("orderNotificationId", "storeId");

-- CreateIndex
CREATE INDEX "IdentityMail_status_availableAt_idx" ON "IdentityMail"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityMail_id_scopeKey_key" ON "IdentityMail"("id", "scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "OrderNotification_id_storeId_key" ON "OrderNotification"("id", "storeId");

-- AddForeignKey
ALTER TABLE "NotificationAttempt" ADD CONSTRAINT "NotificationAttempt_identityMailId_identityScopeKey_fkey" FOREIGN KEY ("identityMailId", "identityScopeKey") REFERENCES "IdentityMail"("id", "scopeKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationAttempt" ADD CONSTRAINT "NotificationAttempt_orderNotificationId_storeId_fkey" FOREIGN KEY ("orderNotificationId", "storeId") REFERENCES "OrderNotification"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;


UPDATE "IdentityMail" SET status='ACCEPTED',provider='legacy',"acceptedAt"="deliveredAt" WHERE "deliveredAt" IS NOT NULL;
ALTER TABLE "OrderNotification" DROP CONSTRAINT "OrderNotification_delivery_check";
ALTER TABLE "OrderNotification" ADD CONSTRAINT "OrderNotification_delivery_check" CHECK (status IN ('PENDING','SENDING','ACCEPTED','DELIVERED','FAILED','UNKNOWN','CANCELLED') AND attempts>=0 AND (status<>'SENDING' OR ("leaseToken" IS NOT NULL AND "lockedUntil" IS NOT NULL AND provider IS NOT NULL)));
ALTER TABLE "IdentityMail" ADD CONSTRAINT "IdentityMail_delivery_check" CHECK (status IN ('PENDING','SENDING','ACCEPTED','DELIVERED','FAILED','UNKNOWN','CANCELLED') AND attempts>=0 AND (status<>'SENDING' OR ("leaseToken" IS NOT NULL AND "lockedUntil" IS NOT NULL AND provider IS NOT NULL)));
ALTER TABLE "NotificationAttempt" ADD CONSTRAINT "NotificationAttempt_source_check" CHECK (("identityMailId" IS NOT NULL AND "identityScopeKey" IS NOT NULL AND "orderNotificationId" IS NULL AND "storeId" IS NULL) OR ("identityMailId" IS NULL AND "identityScopeKey" IS NULL AND "orderNotificationId" IS NOT NULL AND "storeId" IS NOT NULL));
ALTER TABLE "NotificationAttempt" ADD CONSTRAINT "NotificationAttempt_state_check" CHECK ("attemptNumber">0 AND status IN ('SENDING','ACCEPTED','RETRYABLE','REJECTED','UNKNOWN','CANCELLED'));
COMMIT;
