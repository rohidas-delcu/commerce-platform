# Backend verification

Use Node24, pnpm11.25.0 and the committed lockfile. Current actual outcomes and
commit/CI provenance live in IMPLEMENTATION_STATUS.md. These commands were executed;
counts are test-runner cases, not a claim of exhaustive or independent user journeys.

```sh
pnpm install --frozen-lockfile
pnpm db:validate
pnpm db:generate
pnpm test
pnpm typecheck
pnpm build
pnpm test:integration
# Set DATABASE_URL to a disposable PostgreSQL17 database, with public schema.
pnpm db:deploy
pnpm db:deploy
pnpm db:status
pnpm db:drift
NODE_ENV=test pnpm test:migrations
pnpm test:postgres
pnpm demo:backend --verify-and-exit
pnpm audit --prod --audit-level high
```

Read-only HOME cloud install: add `--store-dir /workspace/.pnpm-store`.
Run build-producing suites sequentially: they share apps/api/dist. PostgreSQL
files use concurrency1 to isolate loopback throttle fixtures; never weaken limits.
Fixtures force development mail/local storage, isolate secrets and disable workers
unless that worker is explicitly being tested. No production credentials required.

## Executed coverage

| Area | Evidence |
| --- | --- |
| Merchant | Real HTTP signup/Argon2/one-time verification/login, recovery, CSRF/Origin, rotation/replay, logout/device revocation, suspension, enumeration-safe errors/throttling. |
| Ownership | Account/store role/invitation lifecycle, last-owner races, privilege escalation and revocation-vs-write locks; tenant FKs; historical quarantine without auto-claim. |
| Catalog | Versioned product/variant metadata, exact prices, handles/SKUs, search, collections/order, private/public projections, archive/publication. |
| Media | Real PNG/JPEG raster validation, checksum/length/type guards, HTTP local immutable uploads, tenant linking/branding, public use checks, delete races and fenced cleanup. S3 SDK fakes only. |
| Customers/carts | Independent merchant/two-store namespaces, renamed-cookie attacks, scoped addresses/default races/wishlist, guest capability, merge/retry, no cart reservation, changed prices/availability. |
| Pricing | Exact exclusive/inclusive rounding/allocation, configured shipping/tax, coupons/global/per-customer lease limits, validity/cancellation policy, last-use races and zero-total NOT_REQUIRED. |
| Checkout/orders | Real last-unit reservation race, expiry-after-lock, key/version rejection, server revalidation, immutable COD/SIM snapshots including billing, one order/stock/outbox on retries, safe customer/merchant receipt access. |
| Payments | Durable receipt before finalization, forced order-insert rollback/retry, success/failure/timeout/delayed/out-of-order/duplicate observations, late/mismatched capture review, no oversell. Simulation only. |
| Fulfillment/refunds | Ready/dispatch/delivery/separate COD collection, invalid transitions, exact manual/simulated refunds, unresolved budgets, forced ledger/history rollback, no implied physical return, explicit cancellation restoration. |
| Closure | Existing customer receipts and authorized merchant finance survive store closure; new commerce blocked; editor/foreign/revoked/account-suspended authority denied. |
| Notifications/jobs | Local worker transport, concurrent SKIP LOCKED claims, retries/unknown/late acknowledgements, forced ack rollback, stale challenges/payment notices, private projections, expiry/cleanup races and graceful shutdown. SES SDK fakes only. |
| Gateway boundary | Official-path fake HTTP contracts, private scoped test credentials, raw byte HMAC, authoritative amount/currency/reference checks, no false POST idempotency, PG receipt/dedup and disabled HTTP activation. No Razorpay sandbox/network call. |
| Pagination | 101 account/store/invitation and102 membership records with tied timestamps, complete pages beyond100, tenant privacy/validation and valid bounded continuation. |
| Runtime | Production/demo refusal, invalid key/schema/port/driver and unavailable DB startup, safe error/log output, readiness/shutdown, generated request DTO/OpenAPI paths/query/billing fields. |

Forced failure tests intentionally emit sanitized error events, then assert rollback.
They are not unexplained runtime failures. No cases were skipped in the current runs.

## Migration rehearsal

`test:migrations` requires NODE_ENV=test and CREATE DATABASE privileges. It creates
its own random DB, seeds original Phase0 commerce, stages original committed SQL
and issued identity/session fixtures, upgrades and compares original values. It also
stages the exact26 pre-billing migrations and real financial orders before migration27,
then proves every original order column preserved and billing honestly uncollected.
It verifies repeated deployment/status/drift, quarantine, and exact zero-total
correction DML twice with preserved money/IDs and one audit. Only its owned DB drops.
The complete demo separately proves all27 migrations on a fresh DB and repeatability.
Never reset/db-push an existing database or edit the merged foundation migration.

## Demonstration and unverified limits

`demo:backend --verify-and-exit` drives the complete journey using real HTTP,
worker-delivered private verification mail, local image bytes and a durable simulator.
It asserts one paid order despite retry, stock11 from12, delivery/history and four
order/payment notices; shuts down and removes only owned random data. Both an existing
PostgreSQL connection and Docker provisioning on an isolated loopback port were run.
CI executes the same demo after all regression suites.

These are loopback Node HTTP clients, not real-browser UI acceptance. Provider fakes
are not owned S3/SES/Razorpay sandbox tests. Production startup remains refused; TLS,
secrets, least-privilege/restore/monitoring, financial/security review, browser/BFF
acceptance and tax/legal/privacy/retention policy remain release gates. See
PAYMENT_PROVIDER_BOUNDARY.md and setup-and-deployment.md. No frontend or live settlement.
