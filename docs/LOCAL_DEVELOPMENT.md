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

Media defaults to `OBJECT_STORAGE=local`, immutable files under ignored `.data/media`
(or `DEV_STORAGE_DIR`). Only NODE_ENV=development enables capability upload URLs.
For S3 use `OBJECT_STORAGE=s3`, `S3_REGION`, `S3_BUCKET` and standard AWS credential
resolution. Keep bucket private, permit only scoped object actions/checksums, configure
browser PUT CORS for approved origins/headers, and lifecycle cleanup of expired orphan
uploads. S3 live roundtrip/CORS/IAM verification has not run. Production remains disabled.

Guest carts also require a store customer anonymous session from `auth/csrf`; preserve
both session and cart cookies in the HTTP client. After login call the cart merge API
with both current versions. Carts return merchandise subtotals only; checkout/order
APIs and the complete end-to-end demo are not yet available. Use PostgreSQL for carts.

## Private development mailbox and worker

After generating the client, applying migrations and building, use
`DATA_DRIVER=postgres pnpm worker:once` from the root (the workspace runs in apps/api
and loads its ignored `.env`). Optionally target one owned fixture notification:
`pnpm worker:once identity <IdentityMail UUID>` or `pnpm worker:once order <OrderNotification UUID>`.
The CLI prints counts only. Default `NOTIFICATION_PROVIDER=development` writes private
JSON messages under repository `.data/mail`; set DEV_MAIL_DIR to another private,
application-owned directory if needed. Each stable identity has one file. Files
contain real challenge links: treat them as credentials, keep them out of Git/logs,
and remove them under your development retention policy. There is no public preview.
Reading the file is local development delivery, not real recipient email delivery.

For an API process with automatic delivery set COMMERCE_WORKER_ENABLED=true
(default false). It requires PostgreSQL. Use a separate disposable database/mailbox
for tests; test fixtures force the development provider and disable background work.
The worker handles mail only at this checkpoint; commerce expiry is a separate
pending task. Commands must follow a successful build, and builds must run sequentially.

Application link contracts use MERCHANT_APP_URL and STOREFRONT_APP_URL (development
default localhost5173). Merchant verify/reset/invitation and store customer verify/
reset screens receive a token query parameter; a future client must exchange it
through the existing CSRF-protected POST, never mutate accounts on a GET/prefetch.
Order links use `/stores/:handle/account/orders/:id`. These are client contracts;
no React screens are implemented or claimed operational.

## Commerce expiry

After build/migration, run `DATA_DRIVER=postgres pnpm worker:once maintenance` to
process up to50 due resources per queue (checkouts, standalone reservations, carts).
Append a store UUID to restrict a trusted diagnostic/fixture batch. This is not an
HTTP endpoint or a substitute for tenant authorization. Counts only are printed;
failed/unknown notification or failed expiry batches return a nonzero CLI status.
COMMERCE_WORKER_ENABLED=true now runs expiry and mail sequentially once per tick,
without overlapping batches. Keep it false in deterministic tests. Closed stores
still release abandoned reservations/quota. Expiry preserves history and on-hand
stock; it does not implement legal data retention or delete orphaned upload bytes.

## Development payment simulator

Enable simulator in a development store's versioned pricing policy. Start a payment
against a READY reserved customer checkout through the API contracts above. Manual
simulation is a CSRF-protected store-customer operation; no arbitrary callback becomes
capture proof. DELAYED is durable and completes through trusted reconciliation.
After build, `DATA_DRIVER=postgres pnpm worker:once payments [store UUID]` runs a bounded
batch; COMMERCE_WORKER_ENABLED=true now processes expiry, payments and mail each tick.
Do not run tests against an interactive demo database. UNKNOWN/REVIEW_REQUIRED money
is conservative and may block editing/retrying that cart until supported resolution;
never requeue it blindly. Live gateway capture/refund claims remain disabled.

## Refund processing

`DATA_DRIVER=postgres pnpm worker:once refunds [store UUID]` reconciles a bounded
provider-refund batch after build. The opt-in commerce worker now processes expiry,
payments, refunds and mail. Manual COD records remain explicit CASH_RETURNED assertions;
simulated provider refunds use SUCCESS/FAILURE/TIMEOUT and durable provider state.
Uncertain receipts hold budget until resolved; never create replacement refunds
blindly. A refund does not restock goods. Use an eligible explicit cancellation for
fully repaid, undispatched orders. Financial/existing-order access now survives store archive/suspension for current
owner/admin sessions in an active account. New fulfillment/catalog operations remain
blocked, and suspended accounts do not regain authority through this scope.

To target one payment notice after build: `pnpm worker:once payment <PaymentNotification UUID>`.
Failure/review/no-order-refund mail uses the same private mailbox and safe delivery
semantics; it never exposes merchant references or treats a client callback as proof.
