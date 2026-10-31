BEGIN;
-- AlterTable
ALTER TABLE "NotificationAttempt" ADD COLUMN     "paymentNotificationId" UUID;

-- CreateTable
CREATE TABLE "PaymentNotification" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "refundId" UUID,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "leaseToken" UUID,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentNotification_key_key" ON "PaymentNotification"("key");

-- CreateIndex
CREATE INDEX "PaymentNotification_status_availableAt_idx" ON "PaymentNotification"("status", "availableAt");

-- CreateIndex
CREATE INDEX "PaymentNotification_status_lockedUntil_idx" ON "PaymentNotification"("status", "lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentNotification_id_storeId_key" ON "PaymentNotification"("id", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentNotification_refundId_kind_key" ON "PaymentNotification"("refundId", "kind");

-- CreateIndex
CREATE INDEX "NotificationAttempt_paymentNotificationId_storeId_idx" ON "NotificationAttempt"("paymentNotificationId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_id_storeId_paymentId_key" ON "Refund"("id", "storeId", "paymentId");

-- AddForeignKey
ALTER TABLE "NotificationAttempt" ADD CONSTRAINT "NotificationAttempt_paymentNotificationId_storeId_fkey" FOREIGN KEY ("paymentNotificationId", "storeId") REFERENCES "PaymentNotification"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentNotification" ADD CONSTRAINT "PaymentNotification_paymentId_storeId_fkey" FOREIGN KEY ("paymentId", "storeId") REFERENCES "PaymentAttempt"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentNotification" ADD CONSTRAINT "PaymentNotification_refundId_storeId_paymentId_fkey" FOREIGN KEY ("refundId", "storeId", "paymentId") REFERENCES "Refund"("id", "storeId", "paymentId") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "PaymentNotification" ADD CONSTRAINT "PaymentNotification_source_check" CHECK (length(key)<=200 AND ((kind IN ('PAYMENT_FAILED','PAYMENT_REVIEW') AND "refundId" IS NULL) OR (kind='REFUND_RECORDED' AND "refundId" IS NOT NULL)));
ALTER TABLE "PaymentNotification" ADD CONSTRAINT "PaymentNotification_delivery_check" CHECK (status IN ('PENDING','SENDING','ACCEPTED','DELIVERED','FAILED','UNKNOWN','CANCELLED') AND attempts>=0 AND (status<>'SENDING' OR ("leaseToken" IS NOT NULL AND "lockedUntil" IS NOT NULL AND provider IS NOT NULL)));
ALTER TABLE "NotificationAttempt" DROP CONSTRAINT "NotificationAttempt_source_check";
ALTER TABLE "NotificationAttempt" ADD CONSTRAINT "NotificationAttempt_source_check" CHECK (("identityMailId" IS NOT NULL AND "identityScopeKey" IS NOT NULL AND "orderNotificationId" IS NULL AND "paymentNotificationId" IS NULL AND "storeId" IS NULL) OR ("identityMailId" IS NULL AND "identityScopeKey" IS NULL AND "orderNotificationId" IS NOT NULL AND "paymentNotificationId" IS NULL AND "storeId" IS NOT NULL) OR ("identityMailId" IS NULL AND "identityScopeKey" IS NULL AND "orderNotificationId" IS NULL AND "paymentNotificationId" IS NOT NULL AND "storeId" IS NOT NULL));
COMMIT;
