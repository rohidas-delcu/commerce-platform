BEGIN;
-- CreateTable
CREATE TABLE "Checkout" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "cartVersion" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "contactEmail" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "shippingAddress" JSONB,
    "shippingMethodId" TEXT,
    "snapshot" JSONB,
    "reservationId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Checkout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Checkout_cartId_storeId_idx" ON "Checkout"("cartId", "storeId");

-- CreateIndex
CREATE INDEX "Checkout_status_expiresAt_idx" ON "Checkout"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Checkout_reservationId_storeId_key" ON "Checkout"("reservationId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Checkout_id_storeId_key" ON "Checkout"("id", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Checkout_storeId_customerId_key_key" ON "Checkout"("storeId", "customerId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_id_storeId_customerId_key" ON "Cart"("id", "storeId", "customerId");

-- AddForeignKey
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_customerId_storeId_fkey" FOREIGN KEY ("customerId", "storeId") REFERENCES "Identity"("id", "customerStoreId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_cartId_storeId_customerId_fkey" FOREIGN KEY ("cartId", "storeId", "customerId") REFERENCES "Cart"("id", "storeId", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_reservationId_storeId_fkey" FOREIGN KEY ("reservationId", "storeId") REFERENCES "InventoryReservation"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_status_check" CHECK ("status" IN ('DRAFT','READY','COMPLETED','CANCELLED','EXPIRED') AND "version">=0 AND "cartVersion">=0);
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_request_check" CHECK ("key" ~ '^[A-Za-z0-9_-]{8,100}$' AND "digest" ~ '^[a-f0-9]{64}$');
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_ready_check" CHECK ("status"<>'READY' OR ("reservationId" IS NOT NULL AND "snapshot" IS NOT NULL AND "shippingAddress" IS NOT NULL AND "shippingMethodId" IS NOT NULL));
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_json_check" CHECK (("snapshot" IS NULL OR jsonb_typeof("snapshot")='object') AND ("shippingAddress" IS NULL OR jsonb_typeof("shippingAddress")='object'));
CREATE UNIQUE INDEX "Checkout_one_active_cart" ON "Checkout"("cartId","storeId") WHERE "status" IN ('DRAFT','READY');
COMMIT;
