-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "tokenDigest" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMedia" (
    "storeId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "altText" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("productId","assetId")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_key_key" ON "MediaAsset"("key");

-- CreateIndex
CREATE INDEX "MediaAsset_storeId_status_idx" ON "MediaAsset"("storeId", "status");

-- CreateIndex
CREATE INDEX "MediaAsset_status_expiresAt_idx" ON "MediaAsset"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_id_storeId_key" ON "MediaAsset"("id", "storeId");

-- CreateIndex
CREATE INDEX "ProductMedia_assetId_storeId_idx" ON "ProductMedia"("assetId", "storeId");

-- CreateIndex
CREATE INDEX "ProductMedia_productId_position_idx" ON "ProductMedia"("productId", "position");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_storeId_fkey" FOREIGN KEY ("productId", "storeId") REFERENCES "Product"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_assetId_storeId_fkey" FOREIGN KEY ("assetId", "storeId") REFERENCES "MediaAsset"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_integrity_check" CHECK (
  provider IN ('local','s3') AND status IN ('PENDING','COMPLETE','DELETED') AND
  "contentType" IN ('image/png','image/jpeg') AND size BETWEEN 8 AND 5242880 AND
  checksum ~ '^[a-f0-9]{64}$' AND "tokenDigest" ~ '^[a-f0-9]{64}$' AND key="storeId"::text||'/'||id::text
);
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_position_check" CHECK (position BETWEEN 0 AND 19 AND length("altText")<=300);
CREATE UNIQUE INDEX "ProductMedia_primary_key" ON "ProductMedia"("productId") WHERE "primary";
