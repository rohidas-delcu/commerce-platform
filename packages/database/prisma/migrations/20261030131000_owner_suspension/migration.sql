-- Suspension must freeze a tenant if there is no effective owner left.
CREATE FUNCTION freeze_ownerless_merchant_accounts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> OLD.status AND NEW.status <> 'ACTIVE' THEN
    EXECUTE format('UPDATE %I."MerchantAccount" m SET status = ''RECOVERY_REQUIRED'' WHERE m.status = ''ACTIVE'' AND EXISTS (SELECT 1 FROM %I."MerchantMembership" a WHERE a."merchantId"=m.id AND a."identityId"=$1 AND a.role=''ACCOUNT_OWNER'') AND NOT EXISTS (SELECT 1 FROM %I."MerchantMembership" a JOIN %I."Identity" i ON i.id=a."identityId" WHERE a."merchantId"=m.id AND a.role=''ACCOUNT_OWNER'' AND i.status=''ACTIVE'' AND i."verifiedAt" IS NOT NULL)', TG_TABLE_SCHEMA, TG_TABLE_SCHEMA, TG_TABLE_SCHEMA, TG_TABLE_SCHEMA) USING NEW.id;
    EXECUTE format('UPDATE %I."MerchantInvitation" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "inviterId"=$1 AND "consumedAt" IS NULL AND "revokedAt" IS NULL',TG_TABLE_SCHEMA) USING NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Identity_merchant_suspension" AFTER UPDATE OF status ON "Identity" FOR EACH ROW EXECUTE FUNCTION freeze_ownerless_merchant_accounts();
