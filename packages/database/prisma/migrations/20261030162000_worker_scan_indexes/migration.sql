BEGIN;
CREATE INDEX "InventoryReservation_status_expiresAt_idx" ON "InventoryReservation"("status","expiresAt");
CREATE INDEX "IdentityMail_status_lockedUntil_idx" ON "IdentityMail"("status","lockedUntil");
CREATE INDEX "OrderNotification_status_lockedUntil_idx" ON "OrderNotification"("status","lockedUntil");
COMMIT;
