CREATE TYPE "StoreStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE');

CREATE TABLE "Store" (
  "id" UUID NOT NULL,
  "ownerSubjectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "countryCode" VARCHAR(2) NOT NULL DEFAULT 'IN',
  "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'INR',
  "status" "StoreStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Product" (
  "version" INTEGER NOT NULL DEFAULT 0,
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "collection" TEXT NOT NULL DEFAULT '',
  "priceMinor" BIGINT NOT NULL,
  "compareMinor" BIGINT,
  "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Product_money_check" CHECK (
    "priceMinor" BETWEEN 1 AND 999999999999999999 AND
    ("compareMinor" IS NULL OR ("compareMinor" > "priceMinor" AND "compareMinor" <= 999999999999999999)))
);
CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "stock" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_stock_check" CHECK ("stock" BETWEEN 0 AND 2000000000)
);
CREATE TABLE "InventoryMovement" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "variantId" UUID NOT NULL,
  "before" INTEGER NOT NULL,
  "after" INTEGER NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "actorSubjectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryMovement_stock_check" CHECK (
    "before" BETWEEN 0 AND 2000000000 AND "after" BETWEEN 0 AND 2000000000 AND
    "before" <> "after" AND "delta" = "after" - "before"),
  CONSTRAINT "InventoryMovement_reason_check" CHECK ("reason" IN ('STOCK_COUNT', 'RECEIVED', 'DAMAGED', 'RETURNED', 'OTHER'))
);
CREATE UNIQUE INDEX "Store_handle_key" ON "Store"("handle");
CREATE INDEX "Store_ownerSubjectId_idx" ON "Store"("ownerSubjectId");
CREATE UNIQUE INDEX "Product_storeId_handle_key" ON "Product"("storeId", "handle");
CREATE UNIQUE INDEX "Product_id_storeId_key" ON "Product"("id", "storeId");
CREATE INDEX "Product_storeId_status_idx" ON "Product"("storeId", "status");
CREATE UNIQUE INDEX "ProductVariant_id_storeId_key" ON "ProductVariant"("id", "storeId");
CREATE UNIQUE INDEX "ProductVariant_storeId_sku_key" ON "ProductVariant"("storeId", "sku");
CREATE UNIQUE INDEX "ProductVariant_productId_name_key" ON "ProductVariant"("productId", "name");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "InventoryMovement_storeId_createdAt_idx" ON "InventoryMovement"("storeId", "createdAt");
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_storeId_fkey" FOREIGN KEY ("productId", "storeId") REFERENCES "Product"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_variantId_storeId_fkey" FOREIGN KEY ("variantId", "storeId") REFERENCES "ProductVariant"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;
