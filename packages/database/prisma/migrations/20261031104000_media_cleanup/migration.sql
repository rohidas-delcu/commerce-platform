BEGIN;
-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "cleanupAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "cleanupCheckedAt" TIMESTAMP(3),
ADD COLUMN     "cleanupLease" UUID;

-- CreateIndex
CREATE INDEX "MediaAsset_provider_status_cleanupAfter_idx" ON "MediaAsset"("provider", "status", "cleanupAfter");


ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_cleanup_check" CHECK ("cleanupLease" IS NULL OR status='DELETED');
COMMIT;
