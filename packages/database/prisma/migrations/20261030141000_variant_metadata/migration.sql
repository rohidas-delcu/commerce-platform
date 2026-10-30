-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "compareMinor" BIGINT,
ADD COLUMN     "options" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "priceMinor" BIGINT;

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_price_check" CHECK (
  ("priceMinor" IS NULL AND "compareMinor" IS NULL) OR
  ("priceMinor" IS NOT NULL AND "priceMinor" BETWEEN 1 AND 999999999999999999 AND
    ("compareMinor" IS NULL OR ("compareMinor" > "priceMinor" AND "compareMinor" <= 999999999999999999)))
);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_options_check" CHECK (
  jsonb_typeof(options)='object' AND NOT jsonb_path_exists(options,'$.* ? (@.type() != "string")')
);
