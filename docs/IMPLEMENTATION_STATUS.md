# Current backend implementation status — 2026-10-30

**Full backend mission IN PROGRESS; COD and simulated paid purchase/fulfillment work; full backend remains incomplete.** Continue
verified slices autonomously under BACKEND_REQUIREMENTS.md. No UI, merge or deploy.
Branch `feature/commerce-backend-end-to-end`, based on merged main `6b30e82`.
Draft PR: https://github.com/rohidas-delcu/commerce-platform/pull/2

## Delivered modules

- Merchant identity: Argon2id, email verification/recovery, profile/password,
  session cookies/CSRF, rotation/replay revocation, per-device/all-device logout,
  PostgreSQL throttling, suspension/deactivation safeguards and encrypted mail staging.
- MerchantAccess: accounts, scoped roles/invitations, centralized permissions,
  account/store suspension, last-owner protection, membership revocation checked
  within the same transaction as commerce writes. Legacy data stays quarantined.
- Onboarding foundation: idempotent store creation, resumable/versioned locale,
  timezone/contact/brand settings, complete vs publish separation and archive safeguards.
  Shipping/payment configuration gates completion/publication; verified logo settings
  now support tenant-safe assignment/removal and public branding metadata.
- Catalog: product/variant metadata and lifecycle, SEO, exact prices, scoped handles/
  SKUs, search/sort/bounded offset pages; normalized collections with ordered links.
- Media: bounded reservations, real PNG/JPEG raster/checksum verification, local
  immutable upload capabilities, SDK S3 signing/checksums, ordered/primary images,
  optimistic replacement, safe deletion and public visibility checks. Live S3 unverified.
- Inventory: on-hand/reserved/available, atomic holds, stable keys/digests, bounded
  TTL, release/expiry/commitment, transition history and atomic movements. Commitment
  remains internal; checkout/order commitment and cancellation restoration now use it.
- Carts: guest capabilities in host-only HttpOnly cookies, authenticated store-owned
  carts, versioned edits/clear/refresh, exact server prices and validation messages,
  atomic login merge/retry handling and expiry. No inventory reservation on cart
  creation or editing. Store-configured shipping/tax estimates now have an API;
  coupon application/leases/redemption and durable checkout/order totals now work.
- Customer checkpoint: independent store-scoped identities reuse credential/session
  infrastructure, cookie/origin/CSRF policy and throttles. Customer cookies cannot
  become merchant or another store's authority even when renamed. SQL constraints
  prevent customer identities acquiring merchant memberships. Addresses have scoped
  FKs, optimistic versions and serialized default selection; wishlist uses safe
  public products. Customer order history/detail now uses independent customer scope.

- Pricing checkpoint: versioned country-zone flat/free-threshold shipping, explicit
  NONE/EXCLUSIVE/INCLUSIVE tax settings, a TaxCalculatorPort, exact rounding and
  itemized cart estimates. COD and development simulation now have working processing paths;
  online provider activation remains disabled. Draft configuration can be incomplete; onboarding/publication
  require shipping/payment readiness and tax coverage for shipping destinations.
  Currency cannot be reinterpreted after catalog or pricing values exist.
  Coupon APIs, bounded quota leases and immutable redemption/release ledgers now
  enforce usage and cancellation policy within the same checkout/order transactions.

- Checkout checkpoint: verified store customers can start/resume an idempotent
  checkout, configure contact/address/shipping, obtain a durable quoted inventory
  hold, change inputs with atomic hold release, cancel or expire. Customer-safe
  projections omit private SKU and authority fields. DRAFT lasts24h; READY uses
  the bounded hold lifetime. Guest cart merge precedes this initial authenticated
  checkout API. COD placement now commits immutable orders/stock/outbox atomically;
  manual fulfillment/cash collection/cancellation now have verified APIs; other
  development payments now work; online provider activation and refunds remain pending.

- COD order checkpoint: idempotent READY placement revalidates current cart,
  catalog, currency and policy; commits the hold, order/items, source checkout/cart
  and one notification outbox entry in a single transaction. Orders preserve exact
  prices/contact/shipping/tax snapshots and per-store numbers. COD starts DUE, never
  captured/paid. Customer-safe history/detail and owner/admin merchant read APIs
  are implemented; store editors cannot read order PII. Immutable SQL snapshot/
  item/event guards and exact tax allocation are executed in tests.

- Manual fulfillment: owner/admin commands mark ready → dispatch → delivery;
  COD cash collection is a separate exact-amount action after delivery. Stable
  command keys/digests make retries safe, with optimistic versions and immutable
  events. Eligible unpaid/undispatched cancellation restores committed stock once
  and voids amount due. Forced restoration failure rolls back stock/order/history.
  Internal notes work on open/closed orders and are excluded from the explicit
  customer-visible event allowlist. Notification intents now have independent delivery.

- Coupons: owner/admin management with scoped code uniqueness, versioned fixed/
  percentage rules, dates and usage limits; guest/customer cart application/removal
  and deterministic merge preference. Checkout leases quota alongside inventory,
  preventing last-use races before payment. Order placement consumes once; opt-in
  cancellation restoration follows the policy captured at purchase. Actual expiry,
  per-customer limits and rollback are covered by real HTTP/PostgreSQL journeys.
- Zero totals explicitly use NOT_REQUIRED (paid0/due0), complete on delivery and
  never report a payment or send a payment-confirmation intent. The focused migration
  corrects any earlier zero-DUE state without changing financial values or IDs.

- Account continuity: existing customers retain authenticated profile/address and
  order receipt access after store unpublication/suspension/archive. New signup,
  catalog/wishlist content, carts and checkout still require available commerce.
  Never-used closed namespaces stay private. Namespace/session/tenant/revocation
  checks remain mandatory; historical access does not reactivate a store.

- Store branding: logo settings reuse verified tenant-owned media with optimistic
  settings versions and a compound FK. Public store metadata exposes only approved
  name/locale/branding fields. Logo images follow store publication and cannot be
  deleted while referenced. No frontend/mockup/palette/design changes were made.

- Notifications: shared application/transport ports, private development mailbox,
  explicit SES SDK boundary, PostgreSQL SKIP LOCKED leases/tenant-linked attempt history,
  bounded backoff, UNKNOWN outcome safety, stale challenge suppression and safe receipt
  projections. Optional in-process delivery and trusted one-shot CLI share the service;
  shutdown waits for active sends before closing its transport/database. No public preview.

- Trusted expiry: bounded account/store-locked jobs expire abandoned DRAFT/READY
  checkouts through shared release rules, reclaim standalone inventory holds and expire
  carts. Closed stores/accounts remain eligible without customer impersonation. Stock,
  quota, versions and audit history remain atomic; busy locks are skipped and failures
  preserve state for retry. Optional monolith worker runs expiry before notification.

- Development payments: one durable checkout-bound intent, server-owned exact totals,
  immutable observed receipts and provider event simulation. Shared checkout placement
  commits one paid order/stock/quota/outbox; capture survives failed order insertion.
  Concurrent starts/confirmations and event retries deduplicate. Failure releases holds;
  timeout, delayed reconciliation and late/mismatched capture have explicit states.
  Production simulation is rejected; Razorpay/live processing is not enabled.

## Actual checkpoint evidence

- `pnpm test`: 49 passed, 0 failed/skipped.
- `pnpm typecheck`: passed. Production build passed through integration commands.
- `pnpm test:integration`: 4 passed; memory HTTP/security/startup/shutdown.
- Disposable PostgreSQL `pnpm test:postgres`: 23 passed, 0 failed/skipped. This
  includes shared HTTP/startup checks, real merchant/customer journeys, repository
  and SQL checks; these totals include shared suites, not23 independent purchase flows.
- `NODE_ENV=test DATABASE_URL=... pnpm test:migrations`: passed. Creates its own
  DB, seeds Phase 0 commerce, applies the earlier identity/account/inventory schema,
  seeds existing merchant credentials/sessions, upgrades/repeats/status/drift,
  verifies original commerce/identity/session values and unclaimed quarantine,
  and drops only its own fixture DB. Populated zero-delivered/positive-due/cancelled
  order fixtures also verify the exact correction DML twice, preserving financial
  values and producing one audit entry. Original foundation migration is unchanged.
- Executed PostgreSQL races: stock updates, last-unit reservations, commit/release,
  last-owner removal, membership revocation vs catalog writes, default addresses.
  Forced movement failures roll back counters/state; expiry is rechecked after lock waits.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities reported on
  the locked dependency tree. This does not replace security review.
- Frozen dependency install passed using `/workspace/.pnpm-store`; `pnpm audit --prod`
  reported no known vulnerabilities with the SES SDK dependency included.
- Prisma validation/generation, deployment/repeat/status/drift passed with22 migrations.
- Targeted notification HTTP/PostgreSQL suite passed, including forced acknowledgement
  rollback after file acceptance, concurrent claims, unknown/late receipts, capped retries,
  exact receipt money, private note exclusion, dispatch references and tenant attempt FKs.
- `pnpm worker:once identity 00000000-0000-0000-0000-000000000000` executed and closed
  successfully with zero processed jobs (deliberate nonexistent fixture selector).
- Expiry HTTP/PostgreSQL tests passed for closed/archived/suspended stores/accounts,
  abandoned quota/stock/cart recovery, competing workers, busy-lock skipping,
  tenant selectors, standalone release races and forced history failure rollback.
- `pnpm worker:once maintenance 00000000-0000-0000-0000-000000000000` executed,
  reported zero due fixture jobs and shut down successfully.
- Payment HTTP/PostgreSQL suites passed: concurrent intent creation/confirmation,
  scoped reads, price tampering, cart/checkout locks, exact paid order/delivery,
  failure, timeout, delayed worker success, expired-hold late capture, mismatched
  observations, forced order-insert rollback after capture and safe retry.
- Full regression on current code:49 unit,4 memory HTTP and23 PostgreSQL tests passed;
  typecheck and production build passed; no skipped or failed tests in these runs.
  An earlier ad-hoc parallel PostgreSQL invocation hit shared loopback rate limits;
  corrected sequential targeted/full executions passed. Do not weaken those limits.
- `pnpm worker:once payments 00000000-0000-0000-0000-000000000000` executed a safe
  empty fixture batch successfully. Prisma validation/generation, populated upgrade,
  deployment/repeat/status/drift passed with the new payment migration.
- Latest pushed implementation before this payment checkpoint:
  `7cd97e6f43c246fc2c2179757ca99d1e63430097` (expiry), Actions SUCCESS:
  https://github.com/rohidas-delcu/commerce-platform/actions/runs/41165273450
  Payment local evidence above is current; inspect its CI after push.

## Remaining work and exact next task

1. Commit/push the verified payment checkpoint and inspect remote CI.
2. Exact next implementation task: refund intent/receipt ledger and owner/admin
   financial APIs for manual COD records and idempotent development refunds,
   including late captured payments without an order. Preserve gross paid history;
   refunds do not imply physical restocking or erase order snapshots.
3. Razorpay test-only adapter/signature/reconciliation/refund boundary, scoped to
   merchant-owned credentials; no blind retries or automatic live activation. Official
   SDK docs/source are readable from GitHub; direct provider docs returned HTTP403.
   Provider sandbox checks need owned test credentials and configured webhooks.
4. Payment failure/refund notification intents where appropriate, retention/orphan
   cleanup, deterministic seed and executable full simulated-payment/fulfillment demo,
   remaining response contracts, all E2E flows A–J and final CI/security acceptance.

## Explicit limits and release gates

Production startup remains disabled until full acceptance/security review. Legacy
`/v1/admin` demo headers are development-only and cannot reach real merchant stores.
Customer identity, carts and transactional merchant operations require PostgreSQL; memory
mode serves the isolated catalog/inventory demo, without simulated secure identity.
Email delivery is now implemented as private local files or explicit SES provider
acceptance; live SES delivery is not verified. Simulated capture is explicitly labeled, never gateway settlement. Live S3/SES/Razorpay require
owned provider configuration and executed sandbox checks. No real payment claim.
Overdue holds remain conservative until a trusted expiry batch runs; automatic
expiry is opt-in via COMMERCE_WORKER_ENABLED. Retention/orphan cleanup remains pending. Tombstoned media stays private
on delete failure. Cross-account legal ownership transfer stays disabled; frozen
ownerless accounts need audited operator recovery. No automatic ownership mapping.
Existing customer account/receipt access survives closure; shopping and new signup
remain unavailable. Merchant business mutations remain subject to store/account status.
No tax/legal compliance claim. Browser acceptance, cleanup/retention, breach-password
policy and full security review remain production gates.

Migration history now includes `20261031100000_development_payments` (durable intents, simulator/event history and matching-paid-order constraints),
`20261030162000_worker_scan_indexes` (bounded due/lease scans),
`20261030161000_notification_delivery` (leases and scoped attempt ledger),
`20261030160000_store_branding` (nullable tenant-scoped logo reference),
`20261030155000_coupon_redemption` (coupon quota leases/immutable usage ledgers)
and `20261030155100_zero_amount_orders` (NOT_REQUIRED, preserving amounts/IDs),
`20261030154000_manual_fulfillment` (command ledger, event data and cancellation
movement reason) and `20261030153000_cod_orders` (immutable snapshots/items/events, staged outbox,
exact money/tenant constraints and per-store counters),
`20261030152000_checkout` (source cart/customer/store FK, active-cart uniqueness)
and `20261030151000_store_pricing` (versioned JSON policy) and
`20261030150000_carts` (additive cart/line FKs,
owner/capability CHECKs and one active cart per customer). The earlier
`20261030145000_customer_identity` preserves merchant scope; scoped email
uniqueness replaces the global index atomically while preserving merchant credentials,
IDs and sessions. Fresh cart verification uses disposable `commerce_cart_verified`;
`commerce_merchant_fresh` was used during earlier migration development and is not
the final cart migration verification database. See schema and migration SQL for CHECKs/triggers not modeled by Prisma.

## Historical Phase 0 / design evidence (not current authorization)

# Implementation status

Last evidence update: 2026-10-30. **Phase 0 technical exit criteria met; human review pending.**
No merge, production deployment or Phase 1 implementation is authorized.

## Source and review references

- Repository: `rohidas-delcu/commerce-platform`.
- Branch: `feature/milestone-1-foundation`; target: `main`.
- Verified implementation: `f84f71767e97a9e3f599d4a01f43dd7832f15f32`.
- Draft PR: https://github.com/rohidas-delcu/commerce-platform/pull/1
- Corrected-code Actions run: https://github.com/rohidas-delcu/commerce-platform/actions/runs/41046787135 (completed: success; every required verification step passed).
- Documentation-only follow-up revisions are visible through `git log -- docs/`;
  they do not change the tested implementation. Check the latest branch run before review.

## Root cause and correction

Prisma resolves generator output relative to `packages/database/prisma/schema.prisma`.
Four parent segments resolved outside the checkout to `/workspace/apps/...`;
three correctly resolve to `apps/api/src/generated/prisma` inside the checkout.
Generation had succeeded in CI but placed the client outside the API, causing the
missing-module error and consequent untyped transaction callback. The path is
corrected and CI explicitly asserts the generated client exists. No `any`,
suppression, copied client or verification bypass was used.

## Actual verification on the corrected implementation

Node.js 24.19.0; pnpm 11.25.0; PostgreSQL 17. All commands run from repository root.
Database commands used a fresh disposable `commerce_phase0_verified` database.

| Command/check | Outcome |
| --- | --- |
| `pnpm install --frozen-lockfile --store-dir /workspace/.pnpm-store` | Passed; lockfile unchanged. |
| `pnpm db:validate` | Passed. |
| `pnpm db:generate`; generated `client.ts` location assertion | Passed inside the intended API directory. |
| `pnpm db:deploy` twice | Passed: initial migration applied; repeat had no pending migrations. |
| `pnpm db:status` | Passed: schema up to date. |
| `pnpm db:drift` | Passed: no difference detected. |
| `pnpm test:database` with disposable `DATABASE_URL` | 1 passed; tenant references, uniqueness, exact money, checks and SQL rollback. |
| `pnpm test` | 17 passed; 0 failed/skipped. |
| `pnpm typecheck` | Passed for both database workspace and API. |
| `pnpm build` | Passed; generated client compiled with API. |
| `pnpm test:integration` | 4 passed; 0 failed/skipped, including real memory-backed HTTP, production refusal, startup failure and shutdown checks. |
| `DATABASE_URL=<disposable URL> pnpm test:postgres` | 8 passed; 0 failed/skipped: HTTP, concurrent stock updates, forced adapter rollback, metadata versions and database constraints. |

An initial memory run failed because two local build commands were accidentally
run concurrently against the same `dist` directory. Sequential reruns on the
current implementation passed. Do not run these build-producing suites in parallel.
The PostgreSQL total includes four shared API/security/startup tests, three adapter
tests and one schema test; it is not eight additional independent business flows.

## Verified scope and limits

Store/product/inventory foundation and both adapters now have executed coverage
for ownership, cross-store references even under the same owner, scoped uniqueness,
publication rules, exact money, atomic inventory/history, concurrency, rollback,
request validation, safe errors, public field exclusions, development-only demo
auth, startup/readiness/shutdown and sanitized logging. SQL CHECK constraints are
verified separately because Prisma drift does not represent them.

No current local test failures or technical environment blockers remain. Raw
Actions log download from `results-receiver.actions.githubusercontent.com` was denied,
but GitHub run/step metadata and PR creation are available. Production dependency
audit previously reported no known vulnerabilities at `997edba`; it was not rerun
for this path/test-only correction and is not a permanent security guarantee.

## Phase 0 handoff (historical; current design task follows)

Request human review of draft PR #1 and the migration/security/test evidence.
The corrected-code Actions run succeeded. Confirm the latest documentation-only
branch run is also green before review; its final result is reported in the PR.
Do not merge automatically. After Phase 0 review, wait for explicit Phase 1 scope;
real authentication, React, checkout, payments and additional business features
remain outside current approval. Do not deploy to production.

## Phase 1 design-only handoff — 2026-10-30

Audited backend HEAD `36c998812d43c4fdcb7f74487a304b5ff9e72dab`.
GitHub PR #1 is OPEN (not merged); fetched main is
`3de3dc145a6c81d331b6861c3b7c138c21e2f9c1`. Do not assume Phase 0 merged.
[Design pack](PHASE1_DESIGN.md) covers current contracts, recommended OIDC/session
strategy, memberships/policies, onboarding, migration/rollback, API/screens,
risks, planned E2E tests, work packages and product decisions P01–P10.
No provider or proposed policy is approved. No Phase 1 implementation started.
No application tests rerun; prior results above remain historical evidence.
Only documentation/link checks apply to this revision.

Exact next task: review/resolve P01–P10, including Phase 0 merge/review,
identity authority and tenant/owner semantics, then explicitly authorize a bounded
implementation package. Do not implement React or change production code now.
Latest documentation commit: discover via `git log -- docs/PHASE1_DESIGN.md`;
no new PR or merge was requested for this design-only continuation.
