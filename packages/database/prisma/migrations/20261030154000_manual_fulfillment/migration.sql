BEGIN;
-- AlterTable
ALTER TABLE "OrderEvent" ADD COLUMN     "data" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "OrderCommand" (
    "orderId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderCommand_pkey" PRIMARY KEY ("orderId","key")
);

-- AddForeignKey
ALTER TABLE "OrderCommand" ADD CONSTRAINT "OrderCommand_orderId_storeId_fkey" FOREIGN KEY ("orderId", "storeId") REFERENCES "Order"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "OrderCommand" ADD CONSTRAINT "OrderCommand_request_check" CHECK ("key" ~ '^[A-Za-z0-9_-]{8,100}$' AND "digest" ~ '^[a-f0-9]{64}$');
CREATE TRIGGER "OrderCommand_immutable" BEFORE UPDATE OR DELETE ON "OrderCommand" FOR EACH ROW EXECUTE FUNCTION immutable_order_history();
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_data_check" CHECK (jsonb_typeof("data")='object');
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_reason_check";
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_reason_check" CHECK ("reason" IN ('STOCK_COUNT','RECEIVED','DAMAGED','RETURNED','OTHER','ORDER_COMMITTED','ORDER_CANCELLED'));
COMMIT;
