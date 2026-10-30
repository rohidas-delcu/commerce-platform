BEGIN;
-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "reserved" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservationLine" (
    "reservationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "InventoryReservationLine_pkey" PRIMARY KEY ("reservationId","variantId")
);

-- CreateTable
CREATE TABLE "InventoryReservationEvent" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryReservationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryReservation_storeId_status_expiresAt_idx" ON "InventoryReservation"("storeId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservation_storeId_key_key" ON "InventoryReservation"("storeId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservation_id_storeId_key" ON "InventoryReservation"("id", "storeId");

-- CreateIndex
CREATE INDEX "InventoryReservationLine_variantId_storeId_idx" ON "InventoryReservationLine"("variantId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservationEvent_reservationId_status_key" ON "InventoryReservationEvent"("reservationId", "status");

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservationLine" ADD CONSTRAINT "InventoryReservationLine_reservationId_storeId_fkey" FOREIGN KEY ("reservationId", "storeId") REFERENCES "InventoryReservation"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservationLine" ADD CONSTRAINT "InventoryReservationLine_variantId_storeId_fkey" FOREIGN KEY ("variantId", "storeId") REFERENCES "ProductVariant"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservationEvent" ADD CONSTRAINT "InventoryReservationEvent_reservationId_storeId_fkey" FOREIGN KEY ("reservationId", "storeId") REFERENCES "InventoryReservation"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_reserved_check" CHECK ("reserved" BETWEEN 0 AND "stock");
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_state_check" CHECK ("status" IN ('ACTIVE','RELEASED','EXPIRED','COMMITTED'));
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_request_check" CHECK ("key" ~ '^[A-Za-z0-9_-]{8,100}$' AND "digest" ~ '^[a-f0-9]{64}$' AND "expiresAt">"createdAt");
ALTER TABLE "InventoryReservationLine" ADD CONSTRAINT "InventoryReservationLine_quantity_check" CHECK ("quantity" BETWEEN 1 AND 1000000);
ALTER TABLE "InventoryReservationEvent" ADD CONSTRAINT "InventoryReservationEvent_status_check" CHECK ("status" IN ('ACTIVE','RELEASED','EXPIRED','COMMITTED'));
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_reason_check";
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_reason_check" CHECK ("reason" IN ('STOCK_COUNT','RECEIVED','DAMAGED','RETURNED','OTHER','ORDER_COMMITTED'));
COMMIT;
