BEGIN;
-- DropForeignKey
ALTER TABLE "IdentitySession" DROP CONSTRAINT "IdentitySession_identityId_fkey";

-- DropIndex
DROP INDEX "Identity_email_key";

-- AlterTable
ALTER TABLE "Identity" ADD COLUMN     "customerStoreId" UUID,
ADD COLUMN     "scopeKey" TEXT NOT NULL DEFAULT 'merchant';

-- AlterTable
ALTER TABLE "IdentityMail" ADD COLUMN     "scopeKey" TEXT NOT NULL DEFAULT 'merchant';

-- AlterTable
ALTER TABLE "IdentitySession" ADD COLUMN     "scopeKey" TEXT NOT NULL DEFAULT 'merchant';

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "phone" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerWishlist" (
    "customerId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerWishlist_pkey" PRIMARY KEY ("customerId","productId")
);

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_storeId_idx" ON "CustomerAddress"("customerId", "storeId");

-- CreateIndex
CREATE INDEX "CustomerWishlist_storeId_productId_idx" ON "CustomerWishlist"("storeId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_scopeKey_email_key" ON "Identity"("scopeKey", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_id_scopeKey_key" ON "Identity"("id", "scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_id_customerStoreId_key" ON "Identity"("id", "customerStoreId");

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_customerStoreId_fkey" FOREIGN KEY ("customerStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentitySession" ADD CONSTRAINT "IdentitySession_identityId_scopeKey_fkey" FOREIGN KEY ("identityId", "scopeKey") REFERENCES "Identity"("id", "scopeKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_storeId_fkey" FOREIGN KEY ("customerId", "storeId") REFERENCES "Identity"("id", "customerStoreId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerWishlist" ADD CONSTRAINT "CustomerWishlist_customerId_storeId_fkey" FOREIGN KEY ("customerId", "storeId") REFERENCES "Identity"("id", "customerStoreId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerWishlist" ADD CONSTRAINT "CustomerWishlist_productId_storeId_fkey" FOREIGN KEY ("productId", "storeId") REFERENCES "Product"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Identity" ADD CONSTRAINT "Identity_scope_check" CHECK (("customerStoreId" IS NULL AND "scopeKey"='merchant') OR ("customerStoreId" IS NOT NULL AND "scopeKey"='store:'||"customerStoreId"::text));
CREATE FUNCTION immutable_identity_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."scopeKey" IS DISTINCT FROM OLD."scopeKey" OR NEW."customerStoreId" IS DISTINCT FROM OLD."customerStoreId" THEN RAISE EXCEPTION 'Identity scope is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Identity_immutable_scope" BEFORE UPDATE ON "Identity" FOR EACH ROW EXECUTE FUNCTION immutable_identity_scope();
CREATE FUNCTION require_merchant_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean;
BEGIN
 EXECUTE format('SELECT "customerStoreId" IS NULL FROM %I."Identity" WHERE id=$1',TG_TABLE_SCHEMA) INTO allowed USING (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
 IF allowed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Merchant identity required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "MerchantMembership_identity_scope" BEFORE INSERT OR UPDATE ON "MerchantMembership" FOR EACH ROW EXECUTE FUNCTION require_merchant_identity('identityId');
CREATE TRIGGER "StoreMembership_identity_scope" BEFORE INSERT OR UPDATE ON "StoreMembership" FOR EACH ROW EXECUTE FUNCTION require_merchant_identity('identityId');
CREATE TRIGGER "StoreCreation_identity_scope" BEFORE INSERT OR UPDATE ON "StoreCreation" FOR EACH ROW EXECUTE FUNCTION require_merchant_identity('identityId');
CREATE TRIGGER "MerchantInvitation_identity_scope" BEFORE INSERT OR UPDATE ON "MerchantInvitation" FOR EACH ROW EXECUTE FUNCTION require_merchant_identity('inviterId');
CREATE UNIQUE INDEX "CustomerAddress_one_default" ON "CustomerAddress"("customerId","storeId") WHERE "isDefault";
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_values_check" CHECK ("version">=0 AND length(trim("name")) BETWEEN 1 AND 100 AND length(trim("line1")) BETWEEN 1 AND 200 AND length("line2")<=200 AND length(trim("city")) BETWEEN 1 AND 100 AND length(trim("region")) BETWEEN 1 AND 100 AND length(trim("postalCode")) BETWEEN 1 AND 100 AND "countryCode" IN ('IN','US','GB','CA','AU') AND "phone" ~ '^\+?[0-9 ()-]{7,30}$');
COMMIT;
