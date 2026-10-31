BEGIN;
-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "couponId" UUID;

-- CreateTable
CREATE TABLE "DiscountCoupon" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" BIGINT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "perCustomerLimit" INTEGER,
    "restoreOnCancellation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "holdId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "couponId" UUID NOT NULL,
    "couponVersion" INTEGER NOT NULL,
    "discountMinor" BIGINT NOT NULL,
    "restoreOnCancellation" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "CouponRedemptionRelease" (
    "orderId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemptionRelease_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "CouponHold" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "checkoutId" UUID NOT NULL,
    "checkoutVersion" INTEGER NOT NULL,
    "couponId" UUID NOT NULL,
    "couponVersion" INTEGER NOT NULL,
    "restoreOnCancellation" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CouponHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCoupon_id_storeId_key" ON "DiscountCoupon"("id", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCoupon_storeId_code_key" ON "DiscountCoupon"("storeId", "code");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_customerId_idx" ON "CouponRedemption"("couponId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_holdId_storeId_key" ON "CouponRedemption"("holdId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_orderId_storeId_key" ON "CouponRedemption"("orderId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_orderId_storeId_customerId_key" ON "CouponRedemption"("orderId", "storeId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemptionRelease_orderId_storeId_key" ON "CouponRedemptionRelease"("orderId", "storeId");

-- CreateIndex
CREATE INDEX "CouponHold_couponId_status_expiresAt_idx" ON "CouponHold"("couponId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CouponHold_id_storeId_key" ON "CouponHold"("id", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponHold_checkoutId_checkoutVersion_key" ON "CouponHold"("checkoutId", "checkoutVersion");

-- CreateIndex
CREATE UNIQUE INDEX "Order_id_storeId_customerId_key" ON "Order"("id", "storeId", "customerId");

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_couponId_storeId_fkey" FOREIGN KEY ("couponId", "storeId") REFERENCES "DiscountCoupon"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCoupon" ADD CONSTRAINT "DiscountCoupon_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_holdId_storeId_fkey" FOREIGN KEY ("holdId", "storeId") REFERENCES "CouponHold"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_storeId_customerId_fkey" FOREIGN KEY ("orderId", "storeId", "customerId") REFERENCES "Order"("id", "storeId", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_customerId_storeId_fkey" FOREIGN KEY ("customerId", "storeId") REFERENCES "Identity"("id", "customerStoreId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_storeId_fkey" FOREIGN KEY ("couponId", "storeId") REFERENCES "DiscountCoupon"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemptionRelease" ADD CONSTRAINT "CouponRedemptionRelease_orderId_storeId_fkey" FOREIGN KEY ("orderId", "storeId") REFERENCES "CouponRedemption"("orderId", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponHold" ADD CONSTRAINT "CouponHold_checkoutId_storeId_customerId_fkey" FOREIGN KEY ("checkoutId", "storeId", "customerId") REFERENCES "Checkout"("id", "storeId", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponHold" ADD CONSTRAINT "CouponHold_couponId_storeId_fkey" FOREIGN KEY ("couponId", "storeId") REFERENCES "DiscountCoupon"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "DiscountCoupon" ADD CONSTRAINT "DiscountCoupon_values_check" CHECK ("code" ~ '^[A-Z0-9_-]{3,40}$' AND "version">=0 AND "value">0 AND (("kind"='PERCENTAGE' AND "value"<=10000) OR "kind"='FIXED') AND ("maxUses" IS NULL OR "maxUses" BETWEEN 1 AND 1000000000) AND ("perCustomerLimit" IS NULL OR "perCustomerLimit" BETWEEN 1 AND 1000000000) AND ("startsAt" IS NULL OR "expiresAt" IS NULL OR "expiresAt">"startsAt"));
ALTER TABLE "CouponHold" ADD CONSTRAINT "CouponHold_values_check" CHECK ("checkoutVersion">=0 AND "couponVersion">=0 AND "expiresAt">"createdAt" AND (("status"='HELD' AND "closedAt" IS NULL) OR ("status" IN ('CONSUMED','RELEASED','EXPIRED') AND "closedAt" IS NOT NULL)));
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_values_check" CHECK ("couponVersion">=0 AND "discountMinor">=0);
ALTER TABLE "CouponRedemptionRelease" ADD CONSTRAINT "CouponRedemptionRelease_reason_check" CHECK ("reason"='ORDER_CANCELLED');
CREATE FUNCTION immutable_coupon_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.id IS DISTINCT FROM OLD.id OR NEW."storeId" IS DISTINCT FROM OLD."storeId" OR NEW.code IS DISTINCT FROM OLD.code THEN RAISE EXCEPTION 'Coupon identity/code is immutable' USING ERRCODE='23514'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER "DiscountCoupon_identity" BEFORE UPDATE ON "DiscountCoupon" FOR EACH ROW EXECUTE FUNCTION immutable_coupon_identity();
CREATE FUNCTION immutable_coupon_hold() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['status','closedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','closedAt']) OR (NEW.status IS DISTINCT FROM OLD.status AND OLD.status<>'HELD') THEN RAISE EXCEPTION 'Coupon hold identity is immutable and terminal states cannot reopen' USING ERRCODE='23514'; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status THEN NEW."closedAt"=clock_timestamp(); END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "CouponHold_identity" BEFORE UPDATE ON "CouponHold" FOR EACH ROW EXECUTE FUNCTION immutable_coupon_hold();
CREATE TRIGGER "CouponRedemption_immutable" BEFORE UPDATE OR DELETE ON "CouponRedemption" FOR EACH ROW EXECUTE FUNCTION immutable_order_history();
CREATE TRIGGER "CouponRedemptionRelease_immutable" BEFORE UPDATE OR DELETE ON "CouponRedemptionRelease" FOR EACH ROW EXECUTE FUNCTION immutable_order_history();
COMMIT;
