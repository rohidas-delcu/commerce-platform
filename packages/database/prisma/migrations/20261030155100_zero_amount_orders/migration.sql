BEGIN;
ALTER TABLE "Order" DROP CONSTRAINT "Order_state_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_state_check" CHECK ("status" IN ('PLACED','COMPLETED','CANCELLED') AND "paymentMethod"='COD' AND "paymentStatus" IN ('DUE','PAID','VOID','NOT_REQUIRED') AND "fulfillmentStatus" IN ('UNFULFILLED','READY','DISPATCHED','DELIVERED','CANCELLED') AND "version">=0);
ALTER TABLE "Order" DROP CONSTRAINT "Order_money_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_money_check" CHECK ("subtotalMinor">=0 AND "discountMinor" BETWEEN 0 AND "subtotalMinor" AND "shippingMinor">=0 AND "taxMinor">=0 AND "shippingTaxMinor" BETWEEN 0 AND "taxMinor" AND "totalMinor"="subtotalMinor"-"discountMinor"+"shippingMinor"+CASE WHEN "taxInclusive" THEN 0 ELSE "taxMinor" END AND "amountDueMinor">=0 AND "paidMinor">=0 AND (("paymentStatus"='DUE' AND "amountDueMinor"="totalMinor" AND "paidMinor"=0) OR ("paymentStatus"='PAID' AND "paidMinor"="totalMinor" AND "amountDueMinor"=0) OR ("paymentStatus"='VOID' AND "paidMinor"=0 AND "amountDueMinor"=0) OR ("paymentStatus"='NOT_REQUIRED' AND "totalMinor"=0 AND "paidMinor"=0 AND "amountDueMinor"=0)));
WITH corrected AS (
 UPDATE "Order" SET "paymentStatus"='NOT_REQUIRED',status=CASE WHEN "fulfillmentStatus"='DELIVERED' THEN 'COMPLETED' ELSE status END,"updatedAt"=CURRENT_TIMESTAMP
 WHERE "totalMinor"=0 AND "paidMinor"=0 AND "amountDueMinor"=0 AND "paymentStatus"='DUE' AND status<>'CANCELLED' RETURNING id
) INSERT INTO "IdentityAudit" (id,"identityId",action) SELECT gen_random_uuid(),NULL,'ZERO_AMOUNT_ORDER_CORRECTED:'||id::text FROM corrected;
COMMIT;
