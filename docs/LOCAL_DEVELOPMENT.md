# Local development

Base tools/database setup: [setup-and-deployment.md](setup-and-deployment.md).
Use Node 24, pnpm 11.25.0 and `pnpm install --frozen-lockfile`. Never reset data.
Apply additive migrations with `pnpm db:deploy`, generate with `pnpm db:generate`.

Identity endpoints require DATA_DRIVER=postgres. Memory commerce remains available;
identity returns 503 rather than invent insecure memory persistence semantics.
Run `pnpm dev:setup` to preserve local settings and generate a missing development
`AUTH_OUTBOX_KEY` without printing it. Alternatively configure a random 32-byte
hex key in the ignored local
apps/api/.env (do not print/commit it). A maintained AES-GCM implementation encrypts
verification/reset delivery payloads. Key must survive process restarts; old mail
cannot be read if the key is lost. Production still refuses startup.

Development mail is currently a durable encrypted IdentityMail staging table.
Only trusted test/delivery code imports decryptMail; there is no public token/mail
preview endpoint. SES delivery/worker retries are pending. A complete merchant →
customer → payment → fulfillment demo is **not yet implemented**. The executed
identity HTTP test is a partial developer demonstration, not the requested complete
demo or a verified live email integration.

Run memory and PostgreSQL build-producing test commands sequentially: they share
apps/api/dist. Never run against a production database.
