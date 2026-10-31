# Current backend implementation status — 2026-10-31

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
  development payments now work; online provider activation remains pending; refund processing is delivered below.

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

- Manual COD refunds: owner/admin records confirmed cash returns through the shared
  transaction-bound commerce/authorization port. Immutable ledger and deferred SQL
  balance checks protect exact partial/full refunds and gross paid history. Customer
  receipts include cumulative refunded money without private merchant references.
  Refund records never restock delivered goods. Simulated provider refunds now extend the same ledger; live provider acceptance remains pending.

- Simulated refunds: durable intents/receipt history and pending budget holds,
  exact partial/full repayment, order/payment balance constraints and retry after
  financial-finalization failure. Late captured money without an order can be repaid;
  no synthetic order or stock return is created. Refund alone never restocks goods;
  an eligible explicit cancellation restores undispatched quantities once. Pending/
  full refunds block new dispatch; customer refund history excludes merchant evidence.

- Merchant financial continuity: current owner/admin sessions in an active account
  retain existing-order/finance reads, refunds, cancellation, notes, delivery and COD
  collection after store suspension/archive. A central access intent retains all
  identity/session/role/account/tenant checks. Catalog and new fulfillment stay blocked;
  account suspension denies financial access too. No production or demo auth fallback.

- Payment notices: transactional failure/review and no-order refund messages share
  the existing delivery ports/worker/attempt ledger. Stale outcomes are cancelled
  after recovery; recipients come from the verified scoped customer. Private merchant
  references stay excluded and simulated methods stay explicit. Closure does not
  block financial receipts. No public message preview or real SES delivery claim.

- Razorpay candidate: scoped private test credentials, fixed/bounded HTTPS transport,
  standard byte-exact HMAC, authoritative payment/refund reads, safe amount/currency/
  reference checks and explicit non-idempotent POST contracts. Unit/fake HTTP and
  PostgreSQL receipt/dedup tests execute; no real bank/provider was contacted.
  Gateway HTTP selection/ingress remain disabled. See PAYMENT_PROVIDER_BOUNDARY.md
  for adoption/registry/creation-claim/sandbox/security gates; not production approval.

- Cleanup: bounded expired pending/tombstoned object reconciliation with private
  metadata, shared reference guards, retry leases/backoff, stale-worker fencing and
  daily rechecks. Complete/unlinked library assets and all financial/security history
  stay retained. Local upload/delete races are covered; live S3/lifecycle erasure is
  not verified. No legal data-retention policy has been silently adopted.

## Current verification — billing checkpoint

- `pnpm test`:63 passed,0 failed/skipped. `pnpm typecheck` passed.
- `pnpm build`: passed. `pnpm test:integration`:4 passed,0 failed/skipped.
- `DATABASE_URL=<disposable> pnpm test:postgres`:32 passed,0 failed/skipped.
  Real HTTP, PostgreSQL, SQL constraints, concurrency and rollback; not32 standalone purchase journeys.
- `pnpm db:validate`, `pnpm db:generate`: passed, client generated inside apps/api.
- `pnpm db:deploy` twice, `pnpm db:status`, `pnpm db:drift`: passed with27 migrations.
- `NODE_ENV=test DATABASE_URL=<disposable> pnpm test:migrations`: passed populated
  Phase0/identity/session preservation, historical quarantine, exact pre-billing
  financial/order-column preservation and repeated zero-total correction.
- Billing HTTP/PG test passed COD/SIMULATOR receipts, resume/reset, hold release,
  current payment edit guard, immutable snapshots and customer/public privacy.
- Null/malformed domain addresses now produce INVALID instead of TypeError.
- Latest preceding pushed implementation: f123d30d70f40294769d23ec780b907667cd713f.
  Actions SUCCESS: https://github.com/rohidas-delcu/commerce-platform/actions/runs/41172855548.
  Billing local evidence above is current; inspect its CI after push.

## Remaining work and exact next task

1. Finish and execute the isolated complete backend demo, wire its verify-and-exit
   command into CI, then audit remaining API/configuration contracts.
2. Final current-source install/audit/schema/migration/unit/type/build/HTTP/PG/demo
   regression; update concise continuity docs and draft PR evidence; wait for green CI.
3. Owned S3/SES/Razorpay configuration and provider adoption/activation/sandbox/security
   gates remain external limits. Legal personal/financial retention needs policy review;
   no automatic purge is implemented. No React, merge or production deployment.

## Explicit limits and release gates

Production startup remains disabled until full acceptance/security review. Legacy
`/v1/admin` demo headers require explicit development opt-in and cannot reach real
merchant stores. Identity and transactional journeys require PostgreSQL; memory mode
serves the isolated catalog/inventory demo. Local mail acceptance is verified; real
SES delivery/bounce/complaint handling is not. Simulator capture/refund is explicitly
development-only. Razorpay scoped adapter/signature/receipt contracts are verified
with fakes, but activation/ingress/owned sandbox acceptance remain blocked as documented
in PAYMENT_PROVIDER_BOUNDARY.md. S3 contract fakes are not owned-bucket verification.
Expiry/cleanup require an opt-in worker or trusted CLI. Media cleanup preserves complete
assets; financial/PII/security retention policy is not invented. Historical billing is
honestly null with LEGACY_NOT_COLLECTED; existing money/IDs are preserved. Closed-store
financial/account receipt access retains live account/session/membership authorization.
Cross-account legal ownership transfer and ownerless-account recovery remain disabled.
No tax/legal compliance claim, frontend implementation, merge or deployment.
