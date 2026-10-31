BEGIN;
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "refundedMinor" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Refund_orderId_storeId_createdAt_idx" ON "Refund"("orderId", "storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_id_storeId_key" ON "Refund"("id", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_storeId_key_key" ON "Refund"("storeId", "key");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_storeId_fkey" FOREIGN KEY ("orderId", "storeId") REFERENCES "Order"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Order" DROP CONSTRAINT "Order_state_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_state_check" CHECK (status IN ('PLACED','COMPLETED','CANCELLED') AND "paymentMethod" IN ('COD','SIMULATOR','RAZORPAY') AND "paymentStatus" IN ('DUE','PAID','VOID','NOT_REQUIRED','PARTIALLY_REFUNDED','REFUNDED') AND ("paymentMethod"='COD' OR "paymentStatus" IN ('PAID','PARTIALLY_REFUNDED','REFUNDED')) AND "fulfillmentStatus" IN ('UNFULFILLED','READY','DISPATCHED','DELIVERED','CANCELLED') AND version>=0);
ALTER TABLE "Order" DROP CONSTRAINT "Order_money_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_money_check" CHECK ("subtotalMinor">=0 AND "discountMinor" BETWEEN 0 AND "subtotalMinor" AND "shippingMinor">=0 AND "taxMinor">=0 AND "shippingTaxMinor" BETWEEN 0 AND "taxMinor" AND "totalMinor"="subtotalMinor"-"discountMinor"+"shippingMinor"+CASE WHEN "taxInclusive" THEN 0 ELSE "taxMinor" END AND "amountDueMinor">=0 AND "paidMinor">=0 AND "refundedMinor" BETWEEN 0 AND "paidMinor" AND (("paymentStatus"='DUE' AND "amountDueMinor"="totalMinor" AND "paidMinor"=0 AND "refundedMinor"=0) OR ("paymentStatus"='PAID' AND "paidMinor"="totalMinor" AND "amountDueMinor"=0 AND "refundedMinor"=0) OR ("paymentStatus"='VOID' AND "paidMinor"=0 AND "amountDueMinor"=0 AND "refundedMinor"=0) OR ("paymentStatus"='NOT_REQUIRED' AND "totalMinor"=0 AND "paidMinor"=0 AND "amountDueMinor"=0 AND "refundedMinor"=0) OR ("paymentStatus"='PARTIALLY_REFUNDED' AND "paidMinor"="totalMinor" AND "amountDueMinor"=0 AND "refundedMinor">0 AND "refundedMinor"<"paidMinor") OR ("paymentStatus"='REFUNDED' AND "paidMinor"="totalMinor" AND "amountDueMinor"=0 AND "refundedMinor"="paidMinor" AND "paidMinor">0)));
CREATE OR REPLACE FUNCTION immutable_order_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['status','paymentStatus','fulfillmentStatus','amountDueMinor','paidMinor','refundedMinor','version','updatedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','paymentStatus','fulfillmentStatus','amountDueMinor','paidMinor','refundedMinor','version','updatedAt']) THEN RAISE EXCEPTION 'Order financial and contact snapshot is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_values_check" CHECK (method='MANUAL_COD' AND status='SUCCEEDED' AND "amountMinor">0 AND "currencyCode" IN ('INR','USD','GBP','CAD','AUD') AND key ~ '^[A-Za-z0-9_-]{8,100}$' AND digest ~ '^[a-f0-9]{64}$' AND length(trim(reference)) BETWEEN 1 AND 150 AND reference !~ '[[:cntrl:]]');
CREATE TRIGGER "Refund_immutable" BEFORE UPDATE OR DELETE ON "Refund" FOR EACH ROW EXECUTE FUNCTION immutable_order_history();
CREATE FUNCTION verify_refund_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target UUID; o "Order"; total BIGINT;
BEGIN
 IF TG_TABLE_NAME='Order' THEN target=NEW.id; ELSE target=NEW."orderId"; END IF;
 SELECT * INTO o FROM "Order" WHERE id=target;
 SELECT COALESCE(sum("amountMinor"),0) INTO total FROM "Refund" WHERE "orderId"=target AND "storeId"=o."storeId" AND status='SUCCEEDED';
 IF o."refundedMinor"<>total THEN RAISE EXCEPTION 'Order refund balance must match its immutable ledger' USING ERRCODE='23514'; END IF;
 IF EXISTS (SELECT 1 FROM "Refund" r JOIN "Identity" a ON a.id=r."actorId" WHERE r."orderId"=target AND (r.method<>'MANUAL_COD' OR o."paymentMethod"<>'COD' OR o."paidMinor"<=0 OR r."currencyCode"<>o."currencyCode" OR a."scopeKey"<>'merchant')) THEN RAISE EXCEPTION 'Refund source, currency and merchant actor must match' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER "Order_refund_ledger" AFTER INSERT OR UPDATE ON "Order" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_refund_ledger();
CREATE CONSTRAINT TRIGGER "Refund_order_ledger" AFTER INSERT ON "Refund" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_refund_ledger();
COMMIT;
