BEGIN;
-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "checkoutId" UUID NOT NULL,
    "checkoutVersion" INTEGER NOT NULL,
    "reservationId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "delaySeconds" INTEGER NOT NULL DEFAULT 2,
    "amountMinor" BIGINT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIATING',
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "orderId" UUID,
    "reviewCode" TEXT,
    "nextReconcileAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentObservation" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "expectedAmountMinor" BIGINT NOT NULL,
    "expectedCurrencyCode" VARCHAR(3) NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerOrderId" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatedPayment" (
    "attemptId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'SIMULATOR',
    "amountMinor" BIGINT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "scenario" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulatedPayment_pkey" PRIMARY KEY ("attemptId")
);

-- CreateTable
CREATE TABLE "SimulatedPaymentEvent" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatedPaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_nextReconcileAt_idx" ON "PaymentAttempt"("status", "nextReconcileAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_id_storeId_key" ON "PaymentAttempt"("id", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_id_storeId_method_amountMinor_currencyCode_key" ON "PaymentAttempt"("id", "storeId", "method", "amountMinor", "currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_checkoutId_storeId_customerId_key" ON "PaymentAttempt"("checkoutId", "storeId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_orderId_storeId_customerId_key" ON "PaymentAttempt"("orderId", "storeId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_storeId_customerId_key_key" ON "PaymentAttempt"("storeId", "customerId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_storeId_method_providerOrderId_key" ON "PaymentAttempt"("storeId", "method", "providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_storeId_method_providerPaymentId_key" ON "PaymentAttempt"("storeId", "method", "providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentObservation_storeId_createdAt_idx" ON "PaymentObservation"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentObservation_attemptId_eventId_key" ON "PaymentObservation"("attemptId", "eventId");

-- CreateIndex
CREATE INDEX "SimulatedPayment_status_dueAt_idx" ON "SimulatedPayment"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "SimulatedPayment_attemptId_storeId_key" ON "SimulatedPayment"("attemptId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulatedPayment_attemptId_storeId_method_amountMinor_curre_key" ON "SimulatedPayment"("attemptId", "storeId", "method", "amountMinor", "currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "SimulatedPaymentEvent_attemptId_key_key" ON "SimulatedPaymentEvent"("attemptId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SimulatedPaymentEvent_attemptId_sequence_key" ON "SimulatedPaymentEvent"("attemptId", "sequence");

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_customerId_storeId_fkey" FOREIGN KEY ("customerId", "storeId") REFERENCES "Identity"("id", "customerStoreId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_checkoutId_storeId_customerId_fkey" FOREIGN KEY ("checkoutId", "storeId", "customerId") REFERENCES "Checkout"("id", "storeId", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_reservationId_storeId_fkey" FOREIGN KEY ("reservationId", "storeId") REFERENCES "InventoryReservation"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_storeId_customerId_fkey" FOREIGN KEY ("orderId", "storeId", "customerId") REFERENCES "Order"("id", "storeId", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentObservation" ADD CONSTRAINT "PaymentObservation_attemptId_storeId_method_expectedAmount_fkey" FOREIGN KEY ("attemptId", "storeId", "method", "expectedAmountMinor", "expectedCurrencyCode") REFERENCES "PaymentAttempt"("id", "storeId", "method", "amountMinor", "currencyCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedPayment" ADD CONSTRAINT "SimulatedPayment_attemptId_storeId_method_amountMinor_curr_fkey" FOREIGN KEY ("attemptId", "storeId", "method", "amountMinor", "currencyCode") REFERENCES "PaymentAttempt"("id", "storeId", "method", "amountMinor", "currencyCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedPaymentEvent" ADD CONSTRAINT "SimulatedPaymentEvent_attemptId_storeId_fkey" FOREIGN KEY ("attemptId", "storeId") REFERENCES "SimulatedPayment"("attemptId", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Order" DROP CONSTRAINT "Order_state_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_state_check" CHECK (status IN ('PLACED','COMPLETED','CANCELLED') AND "paymentMethod" IN ('COD','SIMULATOR','RAZORPAY') AND "paymentStatus" IN ('DUE','PAID','VOID','NOT_REQUIRED') AND ("paymentMethod"='COD' OR "paymentStatus"='PAID') AND "fulfillmentStatus" IN ('UNFULFILLED','READY','DISPATCHED','DELIVERED','CANCELLED') AND version>=0);
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_values_check" CHECK ("amountMinor">0 AND "checkoutVersion">=0 AND "delaySeconds" BETWEEN 1 AND 300 AND "currencyCode" IN ('INR','USD','GBP','CAD','AUD') AND method IN ('SIMULATOR','RAZORPAY') AND scenario IN ('MANUAL','SUCCESS','FAILURE','TIMEOUT','DELAYED') AND key ~ '^[A-Za-z0-9_-]{8,100}$' AND digest ~ '^[a-f0-9]{64}$');
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_state_check" CHECK (status IN ('INITIATING','PENDING','UNKNOWN','CAPTURED','SUCCEEDED','FAILED','REVIEW_REQUIRED') AND (status NOT IN ('PENDING','CAPTURED','SUCCEEDED') OR "providerOrderId" IS NOT NULL) AND (status NOT IN ('CAPTURED','SUCCEEDED') OR "providerPaymentId" IS NOT NULL) AND (status<>'SUCCEEDED' OR "orderId" IS NOT NULL) AND ("orderId" IS NULL OR status IN ('SUCCEEDED','REVIEW_REQUIRED')) AND ("providerOrderId" IS NULL OR "providerOrderId" ~ '^[A-Za-z0-9_-]{1,150}$') AND ("providerPaymentId" IS NULL OR "providerPaymentId" ~ '^[A-Za-z0-9_-]{1,150}$'));
ALTER TABLE "PaymentObservation" ADD CONSTRAINT "PaymentObservation_values_check" CHECK (status IN ('PENDING','CAPTURED','FAILED','UNKNOWN') AND "amountMinor">=0 AND "currencyCode" ~ '^[A-Z]{3}$' AND "eventId" ~ '^[A-Za-z0-9_-]{1,200}$' AND "providerOrderId" ~ '^[A-Za-z0-9_-]{1,150}$' AND ("providerPaymentId" IS NULL OR "providerPaymentId" ~ '^[A-Za-z0-9_-]{1,150}$') AND (status<>'CAPTURED' OR "providerPaymentId" IS NOT NULL));
ALTER TABLE "SimulatedPayment" ADD CONSTRAINT "SimulatedPayment_values_check" CHECK (method='SIMULATOR' AND "amountMinor">0 AND version>=0 AND status IN ('PENDING','CAPTURED','FAILED','UNKNOWN') AND scenario IN ('MANUAL','SUCCESS','FAILURE','TIMEOUT','DELAYED') AND ((scenario='DELAYED' AND "dueAt" IS NOT NULL) OR (scenario<>'DELAYED' AND "dueAt" IS NULL)));
ALTER TABLE "SimulatedPaymentEvent" ADD CONSTRAINT "SimulatedPaymentEvent_values_check" CHECK (sequence>=0 AND kind IN ('PENDING','CAPTURED','FAILED','UNKNOWN') AND key ~ '^[A-Za-z0-9_-]{1,100}$');
CREATE FUNCTION immutable_payment_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['status','providerOrderId','providerPaymentId','orderId','reviewCode','nextReconcileAt','updatedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','providerOrderId','providerPaymentId','orderId','reviewCode','nextReconcileAt','updatedAt']) OR (OLD."providerOrderId" IS NOT NULL AND NEW."providerOrderId" IS DISTINCT FROM OLD."providerOrderId") OR (OLD."providerPaymentId" IS NOT NULL AND NEW."providerPaymentId" IS DISTINCT FROM OLD."providerPaymentId") OR (OLD."orderId" IS NOT NULL AND NEW."orderId" IS DISTINCT FROM OLD."orderId") THEN RAISE EXCEPTION 'Payment identity and receipt are immutable' USING ERRCODE='23514'; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND NOT ((OLD.status='INITIATING' AND NEW.status IN ('PENDING','UNKNOWN','REVIEW_REQUIRED')) OR (OLD.status IN ('PENDING','UNKNOWN') AND NEW.status IN ('PENDING','UNKNOWN','CAPTURED','FAILED','REVIEW_REQUIRED')) OR (OLD.status='CAPTURED' AND NEW.status IN ('SUCCEEDED','REVIEW_REQUIRED')) OR (OLD.status='FAILED' AND NEW.status IN ('CAPTURED','REVIEW_REQUIRED')) OR (OLD.status='SUCCEEDED' AND NEW.status='REVIEW_REQUIRED')) THEN RAISE EXCEPTION 'Invalid payment transition' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "PaymentAttempt_immutable" BEFORE UPDATE ON "PaymentAttempt" FOR EACH ROW EXECUTE FUNCTION immutable_payment_attempt();
CREATE TRIGGER "PaymentObservation_immutable" BEFORE UPDATE OR DELETE ON "PaymentObservation" FOR EACH ROW EXECUTE FUNCTION immutable_order_history();
CREATE TRIGGER "SimulatedPaymentEvent_immutable" BEFORE UPDATE OR DELETE ON "SimulatedPaymentEvent" FOR EACH ROW EXECUTE FUNCTION immutable_order_history();
CREATE FUNCTION immutable_simulated_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['status','version','updatedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','updatedAt']) OR NEW.version<>OLD.version+1 OR (OLD.status='CAPTURED' AND NEW.status<>'CAPTURED') OR (OLD.status='FAILED' AND NEW.status IN ('PENDING','UNKNOWN')) THEN RAISE EXCEPTION 'Invalid simulated provider state change' USING ERRCODE='23514'; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER "SimulatedPayment_immutable" BEFORE UPDATE ON "SimulatedPayment" FOR EACH ROW EXECUTE FUNCTION immutable_simulated_payment();
CREATE FUNCTION verify_payment_finalization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "PaymentAttempt"; o "Order";
BEGIN
 IF TG_TABLE_NAME='PaymentAttempt' THEN
  SELECT * INTO p FROM "PaymentAttempt" WHERE id=NEW.id;
  IF p.status IN ('CAPTURED','SUCCEEDED') AND NOT EXISTS (SELECT 1 FROM "PaymentObservation" WHERE "attemptId"=p.id AND "storeId"=p."storeId" AND status='CAPTURED' AND "providerOrderId"=p."providerOrderId" AND "providerPaymentId"=p."providerPaymentId" AND "amountMinor"=p."amountMinor" AND "currencyCode"=p."currencyCode") THEN RAISE EXCEPTION 'A durable matching captured observation is required' USING ERRCODE='23514'; END IF;
  IF p."orderId" IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO o FROM "Order" WHERE id=p."orderId";
 ELSE
  SELECT * INTO o FROM "Order" WHERE id=NEW.id;
  IF o."paymentMethod"='COD' THEN RETURN NULL; END IF;
  SELECT * INTO p FROM "PaymentAttempt" WHERE "orderId"=o.id;
 END IF;
 IF p.id IS NULL OR o.id IS NULL OR p.status NOT IN ('SUCCEEDED','REVIEW_REQUIRED') OR p."storeId"<>o."storeId" OR p."customerId"<>o."customerId" OR p."checkoutId"<>o."checkoutId" OR p.method<>o."paymentMethod" OR p."amountMinor"<>o."totalMinor" OR p."currencyCode"<>o."currencyCode" OR o."paidMinor"<>p."amountMinor" OR o."amountDueMinor"<>0 OR o."paymentStatus"<>'PAID' THEN RAISE EXCEPTION 'Paid order must match its durable payment' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER "PaymentAttempt_finalization" AFTER INSERT OR UPDATE ON "PaymentAttempt" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_payment_finalization();
CREATE CONSTRAINT TRIGGER "Order_payment_finalization" AFTER INSERT OR UPDATE ON "Order" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_payment_finalization();
COMMIT;
