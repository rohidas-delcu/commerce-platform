ALTER TABLE "Identity" ADD CONSTRAINT "Identity_status_check" CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED'));
ALTER TABLE "IdentityChallenge" ADD CONSTRAINT "IdentityChallenge_purpose_check" CHECK (purpose IN ('VERIFY', 'RESET'));
ALTER TABLE "IdentityThrottle" ADD CONSTRAINT "IdentityThrottle_attempts_check" CHECK (attempts > 0);
ALTER TABLE "IdentitySession" ADD CONSTRAINT "IdentitySession_expiry_check" CHECK ("expiresAt" <= "absoluteExpiresAt");
ALTER TABLE "IdentityAudit" ADD CONSTRAINT "IdentityAudit_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Suspension is a security boundary even when invoked through an operations tool.
CREATE FUNCTION revoke_suspended_identity_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> OLD.status AND NEW.status <> 'ACTIVE' THEN
    EXECUTE format('UPDATE %I."IdentitySession" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "identityId" = $1 AND "revokedAt" IS NULL', TG_TABLE_SCHEMA) USING NEW.id;
    EXECUTE format('INSERT INTO %I."IdentityAudit" (id, "identityId", action) VALUES (gen_random_uuid(), $1, $2)', TG_TABLE_SCHEMA) USING NEW.id, 'IDENTITY_DISABLED';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Identity_status_sessions" AFTER UPDATE OF status ON "Identity" FOR EACH ROW EXECUTE FUNCTION revoke_suspended_identity_sessions();
