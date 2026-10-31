BEGIN;
-- AlterTable
ALTER TABLE "PaymentAttempt" ADD COLUMN     "refundedMinor" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "nextReconcileAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "paymentId" UUID,
ADD COLUMN     "providerRefundId" TEXT,
ADD COLUMN     "reviewCode" TEXT,
ADD COLUMN     "simulationScenario" TEXT NOT NULL DEFAULT 'SUCCESS',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "orderId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RefundObservation" (
    "id" UUID NOT NULL,
    "refundId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerRefundId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatedRefund" (
    "refundId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'SIMULATOR',
    "amountMinor" BIGINT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatedRefund_pkey" PRIMARY KEY ("refundId")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefundObservation_refundId_eventId_key" ON "RefundObservation"("refundId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulatedRefund_refundId_storeId_method_amountMinor_currenc_key" ON "SimulatedRefund"("refundId", "storeId", "method", "amountMinor", "currencyCode");

-- CreateIndex
CREATE INDEX "Refund_status_nextReconcileAt_idx" ON "Refund"("status", "nextReconcileAt");

-- CreateIndex
CREATE INDEX "Refund_paymentId_storeId_status_idx" ON "Refund"("paymentId", "storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_id_storeId_method_amountMinor_currencyCode_key" ON "Refund"("id", "storeId", "method", "amountMinor", "currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_storeId_method_providerRefundId_key" ON "Refund"("storeId", "method", "providerRefundId");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_storeId_fkey" FOREIGN KEY ("paymentId", "storeId") REFERENCES "PaymentAttempt"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundObservation" ADD CONSTRAINT "RefundObservation_refundId_storeId_fkey" FOREIGN KEY ("refundId", "storeId") REFERENCES "Refund"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedRefund" ADD CONSTRAINT "SimulatedRefund_refundId_storeId_method_amountMinor_curren_fkey" FOREIGN KEY ("refundId", "storeId", "method", "amountMinor", "currencyCode") REFERENCES "Refund"("id", "storeId", "method", "amountMinor", "currencyCode") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE OR REPLACE FUNCTION immutable_payment_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['status','providerOrderId','providerPaymentId','orderId','reviewCode','nextReconcileAt','refundedMinor','updatedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','providerOrderId','providerPaymentId','orderId','reviewCode','nextReconcileAt','refundedMinor','updatedAt']) OR (OLD."providerOrderId" IS NOT NULL AND NEW."providerOrderId" IS DISTINCT FROM OLD."providerOrderId") OR (OLD."providerPaymentId" IS NOT NULL AND NEW."providerPaymentId" IS DISTINCT FROM OLD."providerPaymentId") OR (OLD."orderId" IS NOT NULL AND NEW."orderId" IS DISTINCT FROM OLD."orderId") THEN RAISE EXCEPTION 'Payment identity and receipt are immutable' USING ERRCODE='23514'; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND NOT ((OLD.status IN ('CAPTURED','SUCCEEDED','REVIEW_REQUIRED') AND NEW.status='REFUNDED') OR (OLD.status='INITIATING' AND NEW.status IN ('PENDING','UNKNOWN','REVIEW_REQUIRED')) OR (OLD.status IN ('PENDING','UNKNOWN') AND NEW.status IN ('PENDING','UNKNOWN','CAPTURED','FAILED','REVIEW_REQUIRED')) OR (OLD.status='CAPTURED' AND NEW.status IN ('SUCCEEDED','REVIEW_REQUIRED')) OR (OLD.status='FAILED' AND NEW.status IN ('CAPTURED','REVIEW_REQUIRED')) OR (OLD.status='SUCCEEDED' AND NEW.status='REVIEW_REQUIRED')) THEN RAISE EXCEPTION 'Invalid payment transition' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION verify_payment_finalization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PaymentAttempt"; o "Order";
BEGIN
 IF TG_TABLE_NAME='PaymentAttempt' THEN
  SELECT * INTO p FROM "PaymentAttempt" WHERE id=NEW.id;
  IF p.status IN ('CAPTURED','SUCCEEDED','REFUNDED') AND NOT EXISTS (SELECT 1 FROM "PaymentObservation" WHERE "attemptId"=p.id AND "storeId"=p."storeId" AND status='CAPTURED' AND "providerOrderId"=p."providerOrderId" AND "providerPaymentId"=p."providerPaymentId" AND "amountMinor"=p."amountMinor" AND "currencyCode"=p."currencyCode") THEN RAISE EXCEPTION 'A durable matching captured observation is required' USING ERRCODE='23514'; END IF;
  IF p."orderId" IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO o FROM "Order" WHERE id=p."orderId";
 ELSE
  SELECT * INTO o FROM "Order" WHERE id=NEW.id;
  IF o."paymentMethod"='COD' THEN RETURN NULL; END IF;
  SELECT * INTO p FROM "PaymentAttempt" WHERE "orderId"=o.id;
 END IF;
 IF p.id IS NULL OR o.id IS NULL OR p.status NOT IN ('SUCCEEDED','REVIEW_REQUIRED','REFUNDED') OR p."storeId"<>o."storeId" OR p."customerId"<>o."customerId" OR p."checkoutId"<>o."checkoutId" OR p.method<>o."paymentMethod" OR p."amountMinor"<>o."totalMinor" OR p."currencyCode"<>o."currencyCode" OR o."paidMinor"<>p."amountMinor" OR o."amountDueMinor"<>0 OR o."paymentStatus" NOT IN ('PAID','PARTIALLY_REFUNDED','REFUNDED') OR o."refundedMinor"<>p."refundedMinor" THEN RAISE EXCEPTION 'Paid order must match its durable payment' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END; $$;

ALTER TABLE "PaymentAttempt" DROP CONSTRAINT "PaymentAttempt_state_check";
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_state_check" CHECK (status IN ('INITIATING','PENDING','UNKNOWN','CAPTURED','SUCCEEDED','FAILED','REVIEW_REQUIRED','REFUNDED') AND (status NOT IN ('PENDING','CAPTURED','SUCCEEDED','REFUNDED') OR "providerOrderId" IS NOT NULL) AND (status NOT IN ('CAPTURED','SUCCEEDED','REFUNDED') OR "providerPaymentId" IS NOT NULL) AND (status<>'SUCCEEDED' OR "orderId" IS NOT NULL) AND ("orderId" IS NULL OR status IN ('SUCCEEDED','REVIEW_REQUIRED','REFUNDED')) AND ("providerOrderId" IS NULL OR "providerOrderId" ~ '^[A-Za-z0-9_-]{1,150}$') AND ("providerPaymentId" IS NULL OR "providerPaymentId" ~ '^[A-Za-z0-9_-]{1,150}$') AND "refundedMinor" BETWEEN 0 AND "amountMinor" AND (status<>'REFUNDED' OR "refundedMinor"="amountMinor") AND ("refundedMinor"<>"amountMinor" OR status='REFUNDED'));
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_values_check";
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_values_check" CHECK ("amountMinor">0 AND "currencyCode" IN ('INR','USD','GBP','CAD','AUD') AND key ~ '^[A-Za-z0-9_-]{8,100}$' AND digest ~ '^[a-f0-9]{64}$' AND length(reference)<=150 AND reference !~ '[[:cntrl:]]' AND "simulationScenario" IN ('SUCCESS','FAILURE','TIMEOUT') AND ((method='MANUAL_COD' AND status='SUCCEEDED' AND "orderId" IS NOT NULL AND "paymentId" IS NULL AND "providerRefundId" IS NULL AND length(trim(reference))>0) OR (method IN ('SIMULATOR','RAZORPAY') AND "paymentId" IS NOT NULL AND status IN ('CREATED','PENDING','UNKNOWN','CONFIRMED','SUCCEEDED','FAILED','REVIEW_REQUIRED') AND (status NOT IN ('PENDING','CONFIRMED','SUCCEEDED') OR "providerRefundId" IS NOT NULL))) AND ("providerRefundId" IS NULL OR "providerRefundId" ~ '^[A-Za-z0-9_-]{1,150}$'));
ALTER TABLE "RefundObservation" ADD CONSTRAINT "RefundObservation_values_check" CHECK (status IN ('PROCESSED','FAILED','PENDING','UNKNOWN') AND "amountMinor">=0 AND "currencyCode" ~ '^[A-Z]{3}$' AND "providerRefundId" ~ '^[A-Za-z0-9_-]{1,150}$' AND "eventId" ~ '^[A-Za-z0-9_-]{1,200}$');
ALTER TABLE "SimulatedRefund" ADD CONSTRAINT "SimulatedRefund_values_check" CHECK (method='SIMULATOR' AND "amountMinor">0 AND status IN ('PROCESSED','FAILED','PENDING','UNKNOWN') AND version>=0);
DROP TRIGGER "Refund_immutable" ON "Refund";
CREATE FUNCTION immutable_refund() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.method='MANUAL_COD' OR (to_jsonb(NEW)-ARRAY['status','providerRefundId','reviewCode','nextReconcileAt','updatedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','providerRefundId','reviewCode','nextReconcileAt','updatedAt']) OR (OLD."providerRefundId" IS NOT NULL AND NEW."providerRefundId" IS DISTINCT FROM OLD."providerRefundId") THEN RAISE EXCEPTION 'Refund identity, amount and receipt are immutable' USING ERRCODE='23514'; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND NOT ((OLD.status='CREATED' AND NEW.status IN ('PENDING','UNKNOWN','REVIEW_REQUIRED')) OR (OLD.status IN ('PENDING','UNKNOWN') AND NEW.status IN ('PENDING','UNKNOWN','CONFIRMED','FAILED','REVIEW_REQUIRED')) OR (OLD.status='CONFIRMED' AND NEW.status IN ('SUCCEEDED','REVIEW_REQUIRED')) OR (OLD.status='FAILED' AND NEW.status IN ('CONFIRMED','REVIEW_REQUIRED'))) THEN RAISE EXCEPTION 'Invalid refund transition' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Refund_identity" BEFORE UPDATE ON "Refund" FOR EACH ROW EXECUTE FUNCTION immutable_refund();
CREATE TRIGGER "Refund_immutable_delete" BEFORE DELETE ON "Refund" FOR EACH ROW EXECUTE FUNCTION immutable_order_history();
CREATE TRIGGER "RefundObservation_immutable" BEFORE UPDATE OR DELETE ON "RefundObservation" FOR EACH ROW EXECUTE FUNCTION immutable_order_history();
CREATE FUNCTION immutable_simulated_refund() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['status','version','updatedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','updatedAt']) OR NEW.version<>OLD.version+1 OR (OLD.status='PROCESSED' AND NEW.status<>'PROCESSED') OR (OLD.status='FAILED' AND NEW.status IN ('PENDING','UNKNOWN')) THEN RAISE EXCEPTION 'Invalid simulated refund update' USING ERRCODE='23514'; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER "SimulatedRefund_identity" BEFORE UPDATE ON "SimulatedRefund" FOR EACH ROW EXECUTE FUNCTION immutable_simulated_refund();
CREATE OR REPLACE FUNCTION verify_refund_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target UUID; o "Order"; p "PaymentAttempt"; r "Refund"; total BIGINT;
BEGIN
 IF TG_TABLE_NAME='Order' THEN target=NEW.id;
 ELSIF TG_TABLE_NAME='PaymentAttempt' THEN SELECT * INTO p FROM "PaymentAttempt" WHERE id=NEW.id; target=p."orderId";
 ELSE
  SELECT * INTO r FROM "Refund" WHERE id=NEW.id; target=r."orderId";
  IF NOT EXISTS (SELECT 1 FROM "Identity" WHERE id=r."actorId" AND "scopeKey"='merchant') THEN RAISE EXCEPTION 'Merchant refund actor required' USING ERRCODE='23514'; END IF;
  IF r.method='MANUAL_COD' THEN
   IF NOT EXISTS (SELECT 1 FROM "Order" WHERE id=r."orderId" AND "storeId"=r."storeId" AND "paymentMethod"='COD' AND "paidMinor">0 AND "currencyCode"=r."currencyCode") THEN RAISE EXCEPTION 'Collected COD refund source required' USING ERRCODE='23514'; END IF;
  ELSE
   SELECT * INTO p FROM "PaymentAttempt" WHERE id=r."paymentId";
   IF p.id IS NULL OR p."storeId"<>r."storeId" OR p.method<>r.method OR p."currencyCode"<>r."currencyCode" OR p."orderId" IS DISTINCT FROM r."orderId" OR p.status NOT IN ('CAPTURED','SUCCEEDED','REVIEW_REQUIRED','REFUNDED') OR NOT EXISTS (SELECT 1 FROM "PaymentObservation" WHERE "attemptId"=p.id AND status='CAPTURED' AND "providerOrderId"=p."providerOrderId" AND "providerPaymentId"=p."providerPaymentId" AND "amountMinor"=p."amountMinor" AND "currencyCode"=p."currencyCode") THEN RAISE EXCEPTION 'Matching captured refund source required' USING ERRCODE='23514'; END IF;
   IF r.status IN ('CONFIRMED','SUCCEEDED') AND NOT EXISTS (SELECT 1 FROM "RefundObservation" WHERE "refundId"=r.id AND status='PROCESSED' AND "providerRefundId"=r."providerRefundId" AND "amountMinor"=r."amountMinor" AND "currencyCode"=r."currencyCode") THEN RAISE EXCEPTION 'Durable matching refund receipt required' USING ERRCODE='23514'; END IF;
  END IF;
 END IF;
 IF p.id IS NOT NULL THEN
  SELECT COALESCE(sum("amountMinor"),0) INTO total FROM "Refund" WHERE "paymentId"=p.id AND "storeId"=p."storeId" AND status='SUCCEEDED';
  IF p."refundedMinor"<>total THEN RAISE EXCEPTION 'Payment refund balance must match ledger' USING ERRCODE='23514'; END IF;
 END IF;
 IF target IS NOT NULL THEN
  SELECT * INTO o FROM "Order" WHERE id=target;
  SELECT COALESCE(sum("amountMinor"),0) INTO total FROM "Refund" WHERE "orderId"=target AND "storeId"=o."storeId" AND status='SUCCEEDED';
  IF o."refundedMinor"<>total THEN RAISE EXCEPTION 'Order refund balance must match ledger' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END; $$;
DROP TRIGGER "Refund_order_ledger" ON "Refund";
CREATE CONSTRAINT TRIGGER "Refund_order_ledger" AFTER INSERT OR UPDATE ON "Refund" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_refund_ledger();
CREATE CONSTRAINT TRIGGER "PaymentAttempt_refund_ledger" AFTER INSERT OR UPDATE ON "PaymentAttempt" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_refund_ledger();
CREATE FUNCTION reserve_refund_budget() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PaymentAttempt"; used NUMERIC;
BEGIN
 IF NEW.method<>'MANUAL_COD' THEN
  SELECT * INTO p FROM "PaymentAttempt" WHERE id=NEW."paymentId" AND "storeId"=NEW."storeId" FOR UPDATE;
  SELECT COALESCE(sum("amountMinor"),0) INTO used FROM "Refund" WHERE "paymentId"=NEW."paymentId" AND "storeId"=NEW."storeId" AND status<>'FAILED';
  IF p.id IS NULL OR used+NEW."amountMinor">p."amountMinor" THEN RAISE EXCEPTION 'Refund budget exhausted' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Refund_budget" BEFORE INSERT ON "Refund" FOR EACH ROW EXECUTE FUNCTION reserve_refund_budget();
COMMIT;
