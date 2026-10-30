-- CreateTable
CREATE TABLE "Collection" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionProduct" (
    "collectionId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionProduct_pkey" PRIMARY KEY ("collectionId","productId")
);

-- CreateIndex
CREATE INDEX "Collection_storeId_status_position_idx" ON "Collection"("storeId", "status", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_storeId_handle_key" ON "Collection"("storeId", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_id_storeId_key" ON "Collection"("id", "storeId");

-- CreateIndex
CREATE INDEX "CollectionProduct_collectionId_position_productId_idx" ON "CollectionProduct"("collectionId", "position", "productId");

-- CreateIndex
CREATE INDEX "CollectionProduct_productId_storeId_idx" ON "CollectionProduct"("productId", "storeId");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_collectionId_storeId_fkey" FOREIGN KEY ("collectionId", "storeId") REFERENCES "Collection"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_productId_storeId_fkey" FOREIGN KEY ("productId", "storeId") REFERENCES "Product"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Collection" ADD CONSTRAINT "Collection_state_check" CHECK (status IN ('ACTIVE','ARCHIVED') AND version>=0 AND position BETWEEN 0 AND 1000000);
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_position_check" CHECK (position BETWEEN 0 AND 1000000);
