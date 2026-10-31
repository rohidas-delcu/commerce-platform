BEGIN;
-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "logoAssetId" UUID;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_logoAssetId_id_fkey" FOREIGN KEY ("logoAssetId", "id") REFERENCES "MediaAsset"("id", "storeId") ON DELETE RESTRICT ON UPDATE RESTRICT;


COMMIT;
