BEGIN;
-- CreateTable
CREATE TABLE "Cart" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "customerId" UUID,
    "secretDigest" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mergedIntoId" UUID,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartLine" (
    "cartId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceSeenMinor" BIGINT NOT NULL,

    CONSTRAINT "CartLine_pkey" PRIMARY KEY ("cartId","variantId")
);

-- CreateIndex
CREATE INDEX "Cart_customerId_storeId_status_idx" ON "Cart"("customerId", "storeId", "status");

-- CreateIndex
CREATE INDEX "Cart_status_expiresAt_idx" ON "Cart"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_id_storeId_key" ON "Cart"("id", "storeId");

-- CreateIndex
CREATE INDEX "CartLine_variantId_storeId_idx" ON "CartLine"("variantId", "storeId");

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_storeId_fkey" FOREIGN KEY ("customerId", "storeId") REFERENCES "Identity"("id", "customerStoreId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_mergedIntoId_storeId_fkey" FOREIGN KEY ("mergedIntoId", "storeId") REFERENCES "Cart"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_cartId_storeId_fkey" FOREIGN KEY ("cartId", "storeId") REFERENCES "Cart"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_variantId_storeId_fkey" FOREIGN KEY ("variantId", "storeId") REFERENCES "ProductVariant"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Cart" ADD CONSTRAINT "Cart_status_check" CHECK ("status" IN ('ACTIVE','MERGED','EXPIRED','CHECKED_OUT') AND "version">=0);
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_ownership_check" CHECK (("customerId" IS NULL AND "secretDigest" IS NOT NULL AND "secretDigest" ~ '^[a-f0-9]{64}$') OR ("customerId" IS NOT NULL AND "secretDigest" IS NULL));
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_merge_check" CHECK (("status"='MERGED' AND "mergedIntoId" IS NOT NULL AND "mergedIntoId"<>id AND "customerId" IS NULL) OR ("status"<>'MERGED' AND "mergedIntoId" IS NULL));
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_expiry_check" CHECK ("expiresAt">"createdAt");
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_values_check" CHECK ("quantity" BETWEEN 1 AND 999 AND "priceSeenMinor" BETWEEN 1 AND 999999999999999999);
CREATE UNIQUE INDEX "Cart_active_customer" ON "Cart"("storeId","customerId") WHERE "status"='ACTIVE' AND "customerId" IS NOT NULL;
COMMIT;
