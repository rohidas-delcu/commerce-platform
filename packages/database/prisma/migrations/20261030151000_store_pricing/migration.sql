BEGIN;
-- CreateTable
CREATE TABLE "StorePricing" (
    "storeId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "shipping" JSONB NOT NULL,
    "tax" JSONB NOT NULL,
    "payments" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePricing_pkey" PRIMARY KEY ("storeId")
);

-- AddForeignKey
ALTER TABLE "StorePricing" ADD CONSTRAINT "StorePricing_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "StorePricing" ADD CONSTRAINT "StorePricing_values_check" CHECK ("version">=0 AND jsonb_typeof("shipping")='array' AND jsonb_typeof("tax")='object' AND jsonb_typeof("payments")='object');
COMMIT;
