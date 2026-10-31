BEGIN;

ALTER TABLE "Checkout" ADD COLUMN "billingAddress" JSONB;
ALTER TABLE "Order" ADD COLUMN "billingAddress" JSONB,
  ADD COLUMN "billingAddressSource" TEXT NOT NULL DEFAULT 'LEGACY_NOT_COLLECTED';
-- Existing snapshots remain untouched: billing was never collected for these orders.
ALTER TABLE "Order" ALTER COLUMN "billingAddressSource" SET DEFAULT 'SHIPPING_DEFAULT';

CREATE FUNCTION order_billing_on_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."billingAddressSource" = 'SHIPPING_DEFAULT' THEN
    NEW."billingAddress" := NEW."shippingAddress";
  ELSIF NEW."billingAddressSource" = 'LEGACY_NOT_COLLECTED' THEN
    RAISE EXCEPTION 'Legacy billing provenance is reserved for pre-migration orders';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_billing_insert BEFORE INSERT ON "Order"
  FOR EACH ROW EXECUTE FUNCTION order_billing_on_insert();

ALTER TABLE "Order" ADD CONSTRAINT "Order_billing_snapshot_check" CHECK (
  ("billingAddressSource" = 'LEGACY_NOT_COLLECTED' AND "billingAddress" IS NULL)
  OR ("billingAddressSource" IN ('SHIPPING_DEFAULT', 'CUSTOMER_PROVIDED')
    AND "billingAddress" IS NOT NULL AND jsonb_typeof("billingAddress") = 'object'
    AND ("billingAddressSource" <> 'SHIPPING_DEFAULT' OR "billingAddress" = "shippingAddress"))
);
-- The existing immutable_order_snapshot trigger also protects both new columns.
COMMIT;
