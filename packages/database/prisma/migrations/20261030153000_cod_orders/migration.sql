BEGIN;
-- CreateTable
CREATE TABLE "StoreOrderCounter" (
    "storeId" UUID NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "StoreOrderCounter_pkey" PRIMARY KEY ("storeId")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "checkoutId" UUID NOT NULL,
    "placementKey" TEXT NOT NULL,
    "placementDigest" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLACED',
    "paymentMethod" TEXT NOT NULL DEFAULT 'COD',
    "paymentStatus" TEXT NOT NULL DEFAULT 'DUE',
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'UNFULFILLED',
    "contactEmail" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "shippingAddress" JSONB NOT NULL,
    "shippingMethodName" TEXT NOT NULL,
    "taxSnapshot" JSONB NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "subtotalMinor" BIGINT NOT NULL,
    "discountMinor" BIGINT NOT NULL,
    "shippingMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL,
    "shippingTaxMinor" BIGINT NOT NULL,
    "taxInclusive" BOOLEAN NOT NULL,
    "totalMinor" BIGINT NOT NULL,
    "amountDueMinor" BIGINT NOT NULL,
    "paidMinor" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productName" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" BIGINT NOT NULL,
    "subtotalMinor" BIGINT NOT NULL,
    "discountMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderNotification" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_storeId_createdAt_idx" ON "Order"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_customerId_storeId_createdAt_idx" ON "Order"("customerId", "storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_id_storeId_key" ON "Order"("id", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutId_storeId_customerId_key" ON "Order"("checkoutId", "storeId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_storeId_customerId_placementKey_key" ON "Order"("storeId", "customerId", "placementKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_storeId_number_key" ON "Order"("storeId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_variantId_key" ON "OrderItem"("orderId", "variantId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderNotification_key_key" ON "OrderNotification"("key");

-- CreateIndex
CREATE INDEX "OrderNotification_status_availableAt_idx" ON "OrderNotification"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "Checkout_id_storeId_customerId_key" ON "Checkout"("id", "storeId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_id_storeId_productId_key" ON "ProductVariant"("id", "storeId", "productId");

-- AddForeignKey
ALTER TABLE "StoreOrderCounter" ADD CONSTRAINT "StoreOrderCounter_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_storeId_fkey" FOREIGN KEY ("customerId", "storeId") REFERENCES "Identity"("id", "customerStoreId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_checkoutId_storeId_customerId_fkey" FOREIGN KEY ("checkoutId", "storeId", "customerId") REFERENCES "Checkout"("id", "storeId", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_storeId_fkey" FOREIGN KEY ("orderId", "storeId") REFERENCES "Order"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_storeId_productId_fkey" FOREIGN KEY ("variantId", "storeId", "productId") REFERENCES "ProductVariant"("id", "storeId", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_storeId_fkey" FOREIGN KEY ("orderId", "storeId") REFERENCES "Order"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderNotification" ADD CONSTRAINT "OrderNotification_orderId_storeId_fkey" FOREIGN KEY ("orderId", "storeId") REFERENCES "Order"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "StoreOrderCounter" ADD CONSTRAINT "StoreOrderCounter_value_check" CHECK ("value">=0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_state_check" CHECK ("status" IN ('PLACED','COMPLETED','CANCELLED') AND "paymentMethod"='COD' AND "paymentStatus" IN ('DUE','PAID','VOID') AND "fulfillmentStatus" IN ('UNFULFILLED','READY','DISPATCHED','DELIVERED','CANCELLED') AND "version">=0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_money_check" CHECK ("subtotalMinor">=0 AND "discountMinor" BETWEEN 0 AND "subtotalMinor" AND "shippingMinor">=0 AND "taxMinor">=0 AND "shippingTaxMinor" BETWEEN 0 AND "taxMinor" AND "totalMinor"="subtotalMinor"-"discountMinor"+"shippingMinor"+CASE WHEN "taxInclusive" THEN 0 ELSE "taxMinor" END AND "amountDueMinor">=0 AND "paidMinor">=0 AND (("paymentStatus"='DUE' AND "amountDueMinor"="totalMinor" AND "paidMinor"=0) OR ("paymentStatus"='PAID' AND "paidMinor"="totalMinor" AND "amountDueMinor"=0) OR ("paymentStatus"='VOID' AND "paidMinor"=0 AND "amountDueMinor"=0)));
ALTER TABLE "Order" ADD CONSTRAINT "Order_request_check" CHECK ("placementKey" ~ '^[A-Za-z0-9_-]{8,100}$' AND "placementDigest" ~ '^[a-f0-9]{64}$' AND "currencyCode" IN ('INR','USD','GBP','CAD','AUD') AND jsonb_typeof("shippingAddress")='object' AND jsonb_typeof("taxSnapshot")='object');
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_money_check" CHECK ("quantity" BETWEEN 1 AND 999 AND "unitPriceMinor">0 AND "subtotalMinor"="unitPriceMinor"*"quantity" AND "discountMinor" BETWEEN 0 AND "subtotalMinor" AND "taxMinor">=0);
ALTER TABLE "OrderNotification" ADD CONSTRAINT "OrderNotification_delivery_check" CHECK ("status" IN ('PENDING','SENDING','DELIVERED','FAILED') AND "attempts">=0);
CREATE FUNCTION immutable_order_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['status','paymentStatus','fulfillmentStatus','amountDueMinor','paidMinor','version','updatedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','paymentStatus','fulfillmentStatus','amountDueMinor','paidMinor','version','updatedAt']) THEN RAISE EXCEPTION 'Order financial and contact snapshot is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Order_immutable_snapshot" BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION immutable_order_snapshot();
CREATE FUNCTION immutable_order_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Order items and event history are immutable' USING ERRCODE='23514'; END; $$;
CREATE TRIGGER "OrderItem_immutable" BEFORE UPDATE OR DELETE ON "OrderItem" FOR EACH ROW EXECUTE FUNCTION immutable_order_history();
CREATE TRIGGER "OrderEvent_immutable" BEFORE UPDATE OR DELETE ON "OrderEvent" FOR EACH ROW EXECUTE FUNCTION immutable_order_history();
COMMIT;
