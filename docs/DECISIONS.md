# Decision log

Record approved decisions with context, consequences and evidence. Distinguish
implementation choices from verified behavior. Append or explicitly supersede
entries when decisions change; do not silently rewrite approval history.

| ID | Decision | Context and consequence |
| --- | --- | --- |
| D001 | One authoritative commerce backend; modular monorepo, no unnecessary microservices. | Approved long-term direction. Keep domain/application boundaries and avoid duplicated business logic across clients/adapters. |
| D002 | NestJS, TypeScript/NodeNext, pnpm workspaces, Prisma 7 and PostgreSQL; development memory adapter. | Imported foundation stack retained. Database workspace owns schema/migrations; generated ESM client belongs to API. Resolved/pinned tooling is in manifests/lockfile. |
| D003 | Store-scoped ownership and uniqueness; exact minor-unit money strings. | Approved foundation invariants. Public catalog explicitly selects safe fields; money does not use floating point. |
| D004 | Demo identity is development-only; production startup refuses. | No real merchant authentication is implemented. Headers permit impersonation. A production authentication change needs a separately approved and reviewed design. |
| D005 | Atomic stock update plus movement; optimistic concurrency for stock and product metadata. | Phase 0 hardening in `997edba` prevents stale changes and inventory-history divergence. Memory and PostgreSQL adapter concurrency/rollback tests passed on corrected implementation `f84f717`. |
| D006 | Committed SQL migrations with database constraints and composite tenant references. | Missing migration history was addressed in `997edba`. Direct SQL constraints and Prisma deployment/repeatability/status/drift passed on corrected implementation `f84f717`. Preserve CHECK constraints Prisma cannot represent. |
| D007 | Verified phases and review gates; no automatic merge or Phase 1 work. | Explicit user requirement. Current Phase 0 includes backend verification only; no React, mockup edits, real payments or unrelated business features. Future phase scope remains undecided. |
| D008 | Version-controlled agent continuity documents and evidence-based status. | Explicit continuity requirement. Update status, pending work, tests/issues, relevant commit/PR and exact next task at each phase or blocked handoff. Never promote code presence to verified completion. |

Decisions above summarize approved direction and committed Phase 0 choices as of
2026-10-30. No production hosting, authentication provider, frontend framework
implementation plan or visual token set has been approved through this log.

Implementation correction (2026-10-30): generator output is schema-relative; use
`../../../apps/api/src/generated/prisma`. This repairs D002 configuration and
does not change the architecture. See the Phase 0 audit for executed evidence.

## Phase 1 design review (2026-10-30)

[Phase 1 design and decision pack](PHASE1_DESIGN.md) records the requested
identity, membership, onboarding, migration and frontend-contract proposals.
Design work is authorized; implementation and provider selection are not.
Phase 0 PR #1 is still open and fetched main remains at `3de3dc1`.
All P01–P10 decisions require approval; this link does not adopt them.

## Superseding backend implementation authorization — 2026-10-30

Phase 0 was merged through PR #1 at `6b30e822eef709087308d12d8024766f4b4d4ef8`.
The user now authorizes the complete backend mission in
[BACKEND_REQUIREMENTS.md](BACKEND_REQUIREMENTS.md), including first-party Argon2id
credentials behind an IdentityAuthorityPort, accounts/membership/onboarding,
catalog/media, inventory reservations, customer auth, cart/pricing/checkout,
COD/development payments/provider boundaries, orders/fulfillment and notifications.
Earlier design-only and unmerged-main statements are historical, not current gates.
No frontend, automatic merge, production deployment or unsafe provider fallback.
Provider credentials/sandbox acceptance remain required for live activation.
See IMPLEMENTATION_STATUS.md for actual delivered scope, not this authorization.

## Inventory hold consistency (implementation, 2026-10-30)

Keep existing stock as on-hand and add reserved, constrained 0<=reserved<=stock.
Use durable tenant-scoped multi-line reservations with request digests, 60–1800s TTL
and explicit terminal states. Never reserve permanently on cart creation. Checkout
will own commitment through the shared inventory port; merchant HTTP exposes hold
creation/read/release/expiry only. Expiry processing is conservative until the worker
slice: overdue holds still reduce availability, and cannot commit. Recheck server/DB
time after lock waits. Release/commit lock the reservation and variants and atomically
record transitions; failed movement insertion rolls back all counters and state.

## Customer credential namespace (implementation, 2026-10-30)

Use distinct Identity rows keyed by scope/email, with customerStoreId as a real FK
and immutable namespace. Reuse hashing/challenges/sessions/CSRF/throttling through
ports. Merchant and customer registrations with the same email remain independent;
no automatic account linking or permission merging. Compound session FKs and scoped
repository reads prevent cookie renaming changing authority. SQL triggers forbid
customer identities in merchant membership/invitation/creation authority records.

Replace the global email unique index with scoped uniqueness in one migration
transaction, defaulting existing identities/sessions/mail to `merchant`. Preserve
all existing data; migration rehearsal now covers existing credential/session values.
Customer cookies use store UUID names, HttpOnly, host-only and production Secure
__Host- policy. Allowed-origin credentialed CORS supports future browser clients;
custom domains require appropriate approved origins and same-origin BFF handling.
Store-scoped address defaults serialize on the customer identity, with a partial
unique SQL index. Default replacement increments affected address versions.

## Carts and storefront transaction scope (implementation, 2026-10-30)

Share one transactional storefront-session authority helper across addresses/wishlist
and carts; identity/session → account → store locks recheck revoked/suspended scope.
Guest cart capabilities are independent host-only HttpOnly cookies containing random
secrets; persist only digests. Authenticated carts use customer identity plus tenant
FKs. No merchant cookie or cart capability becomes customer authority. Retain quantity
and server-observed price for change warnings; prices/totals always refresh from the
catalog. Guest carts expire at seven days; owned cart mutations renew a seven-day
idle deadline. No cart-based inventory reservation. Merge is an atomic one-time
source transition, with destination/source versions and quantity/item bounds. This
policy is initial backend behavior; production remains gated on complete acceptance.

## Configured shipping/tax estimates (implementation, 2026-10-30)

Use a versioned store policy with country shipping zones, flat rates and optional
free thresholds. Apply the threshold to merchandise after discounts. Tax is explicit
NONE/EXCLUSIVE/INCLUSIVE, with configured jurisdiction basis points and an adapter
port; shipping taxability is explicit. Round nonnegative rational amounts half-up in
minor units; inclusive tax is informational within the total, exclusive tax is added.
No default legal rates or tax compliance claim. Quote amounts are bounded by signed
PostgreSQL BigInt and currency comes from the store. Estimates expose policy/cart
versions and require final checkout revalidation; they are not payment authorization.
Store currency cannot change after money-valued catalog or pricing configuration
exists. Completion/publication checks shipping/payment readiness; existing records
are preserved without inventing policy data. Coupon usage must be committed with
orders; current pure coupon arithmetic is not a delivered redemption workflow.

## Durable checkout reservation checkpoint (implementation, 2026-10-30)

Initial checkout API uses a verified store customer and an owned/merged cart. Guest
carts/estimates remain supported; guest order placement is not implemented. Bind start
keys to cart/version; preserve a single active checkout per cart with composite
customer/cart/store references. Persist quoted minor-unit item/tax/shipping snapshots
and internal SKU, while explicit customer projections omit SKU/authority fields.
DRAFT has a24h deadline; READY expires with its stock hold. Input changes atomically
release holds and clear quotes; quote replacement rolls back on failure. No inventory
commitment or order is inferred from READY. Order placement must revalidate before
committing, and notification/payment/fulfillment states stay separate. Do not enable
production or claim full checkout acceptance at this checkpoint.

## COD order placement and immutable snapshots (implementation, 2026-10-30)

Commit validated READY checkout/hold, immutable order/items, cart completion and a
unique notification intent in one PostgreSQL transaction. Recheck current catalog,
cart/currency/policy and inventory expiry; refuse changed quotes rather than silently
changing a charge. Place COD as amount-due, not captured/paid. Use per-store transactional
number counters and customer-scoped request digests/source uniqueness for retries.
Allocate discount/tax integer units by deterministic largest remainder, including a
shipping tax component; persist tax inclusion explicitly. Customer order projections
omit SKU/authority; merchant order read permission is owner/admin only initially.
SQL prevents snapshot/item/event mutation. Notification intents are durable and pending;
delivery workers and full cash/fulfillment/cancellation lifecycles still follow.

## Manual fulfillment and cash reporting (implementation, 2026-10-30)

Use forward manual READY/DISPATCH/DELIVER actions, with optional plain carrier/reference
text; do not integrate courier APIs. Allow unpaid COD fulfillment. Require delivered
state and exact outstanding amount before an authorized merchant records collected
cash; this is not provider capture. Cancellation is limited to unpaid/undispatched
orders and atomically restores committed quantities once, using the existing stock
adjustment contract. Never assume a monetary refund means physical stock was returned.
Command keys/digests and optimistic versions protect concurrent retries, preserving
immutable events/snapshots. Owner/admin order-manage permission is centralized. Private
notes can append to closed orders but are excluded from customer-visible history.
Keep notification staging transactional; delivery and refunds still require later slices.

## Coupon quota, immutable usage and zero totals (implementation, 2026-10-30)

Use normalized tenant-scoped coupon records and bounded quota leases aligned with
checkout stock holds. Count consumed uses plus other live leases; exclude the same
cart's own lease when displaying/revalidating its quote. This prevents last-use races
before a later asynchronous payment. Consume a lease and append redemption with order
placement; rollback all effects on failure. Checkout cancellation/expiry releases only
unconsumed quota. Consumed quota restoration is explicit (default false), snapshotted
at purchase and represented by a separate immutable release record. Do not rewrite
financial snapshots or old redemption records when policy changes. Codes are immutable,
store-scoped, uppercase; percentages are integer basis points and discounts do not stack.
Owned-cart coupon wins during merge, otherwise carry/revalidate the guest coupon.

A fully discounted/free-shipping order has NOT_REQUIRED, paid0/due0, and completes on
delivery. It never implies money was captured or cash collected. Correct earlier
zero-DUE records with an idempotent audited data migration preserving IDs/amounts;
positive/void orders remain unchanged. Both the real API flow and populated correction
DML are executed. Currency is fixed once catalog/pricing/coupon monetary data exists.

## Customer continuity after closure (implementation, 2026-10-30)

Separate account availability from commerce availability. Previously used managed
store namespaces allow existing-customer authentication/recovery, own profile/addresses
and immutable receipts after unpublish/suspend/archive. New signup and all shopping
still need published, available commerce; catalog-derived wishlist data stays hidden.
An unused closed namespace remains404. The shared transactional authority helper
still checks exact store/customer/session namespace, revocation and tenant references;
account mode changes only publication availability. Controller metadata selects a
use-case intent; policy is centralized, not independent controller role logic.

## Store branding assets (implementation, 2026-10-30)

Store logo is an optional verified MediaAsset reference, never an external URL.
Composite tenant FK and settings/asset locks prevent foreign/pending assignment;
logo references protect deletion like product images. Clear a logo explicitly before
deleting its bytes. Public store profile selects only name/locale/branding fields;
logo publication uses the same store availability policy as catalog/media. Keep logo
optional rather than inventing placeholder artwork, colors or a new storefront design.

## Durable notification delivery (implementation, 2026-10-30)

Keep identity and order intents transactional with their source operations; deliver
through a shared application service and transport port in the same monolith.
Claim bounded batches with PostgreSQL SKIP LOCKED leases and record every attempt
with a source/tenant FK. Only a positive provider receipt means ACCEPTED; this is
not proof of inbox delivery. Retry definite throttling/local I/O with bounded
exponential backoff (five attempts). Uncertain SES/network results and expired
non-idempotent leases become UNKNOWN and require reconciliation; never blindly
resend. Late original receipts may resolve their own lease, never a newer lease.

Development delivery writes one private mode0600 JSON file per immutable message
identity under a mode0700 directory. Replays deduplicate by that identity. No public
mailbox/token preview API. SES uses the official SDK with automatic retries disabled,
explicit sender/region/HTTPS application links and no development fallback. Secrets,
recipients and body/token contents stay out of operational logs. SES acceptance,
bounce/complaint processing, retention and live sandbox checks remain distinct gates.

## Trusted commerce expiry (implementation, 2026-10-31)

Run expiry in the same monolith through MaintenanceService and a trusted internal
repository, never an impersonated merchant/customer or public administrative endpoint.
Account → store → resource locks align with request mutations; SKIP LOCKED avoids
waiting on busy stores. Re-read deadlines under locks using the database clock.
Share checkout release/expiry and cart transitions with request paths, and use the
existing inventory transition adapter. Expire one resource transaction at a time;
failure rolls back stock, quota/state/history and stays due for retry. Closure or
suspension cannot prevent resource reclamation. Keep inventory on-hand unchanged.
No record deletion/retention policy is inferred from expiry; financial history stays.

## Development payment observations and order commitment (implementation, 2026-10-31)

Use PaymentPort for provider intent creation and authoritative observation, with an
explicit development simulation capability separate from the generic provider port.
Only SIMULATOR is wired at this checkpoint; no live or Razorpay fallback exists.
Persist immutable verified observations before a second transaction finalizes the
order. If order insertion fails, the captured receipt survives and reconciliation
can retry the same logical order. Reuse one checkout validation/placement implementation
for COD and captured payments, preserving stock/quota/snapshot invariants.

A checkout has one durable payment identity, with immutable quote/amount/currency,
source hold/version and request digest. Payment/checkout/cart mutations cannot race
an in-flight or unresolved payment. Provider capture is distinct from order success;
late, mismatched or unfulfillable money becomes REVIEW_REQUIRED, never an oversold
paid order. Timeouts remain UNKNOWN until an authoritative result or review. Expiry
still releases bounded holds. Definitive failure cancels that checkout and releases
holds atomically; an active cart can start a new checkout once no unresolved payment
blocks it. Paid simulated fulfillment completes on delivery without COD collection.

The simulator persists provider state and immutable event identities, supports manual,
success/failure/timeout/delay, deduplicates repeated events and never downgrades capture
on an out-of-order failure. It refuses production; SIMULATOR remains explicit in orders.
Deferred SQL constraints require a matching observation and tenant/amount-consistent
payment before an online order can commit. Full provider/refund/recovery acceptance
remains pending; do not mark bank/gateway settlement or legal compliance verified.

## Manual COD refund records (implementation, 2026-10-31)

Collected COD can record exact partial/full cash returns only through owner/admin
order-manage authority, explicit CASH_RETURNED confirmation and a private reference.
This records the merchant's cash action, not bank/gateway verification. Preserve gross
paid and immutable original totals; add a separate refunded balance and immutable
ledger. Same-key retries cannot add money twice; optimistic versions and store/order
locks prevent over-refunds. A deferred SQL invariant ties the balance to the ledger.
Refund failure rolls back balance/event/notification atomically. Never restore stock
or change delivered fulfillment merely because cash was refunded. Online/development
provider refunds and late-payment resolution remain the next distinct slice.

## Simulated provider refunds and unresolved capture recovery (implementation, 2026-10-31)

Extend the same Refund ledger for asynchronous provider intents; do not create a
second financial ledger. Reserve refund budget across created/pending/unknown/
confirmed/successful/review rows, with failed intents excluded. Only a matching,
immutable PROCESSED observation can update refunded balances. Persist the provider
receipt before a second transaction updates refund/payment/order/history/outbox;
financial-update failures remain safely retryable without repeating money movement.
The simulator commits its own provider state before emulating a lost response.

Preserve gross captured/paid and source snapshots. Full repayment becomes REFUNDED;
matching captured money without an order can be returned without inventing an order
or inventory movement. An unresolved partial repayment stays in review. Store/customer
namespaces and actor authority are rechecked when the merchant creates an intent;
trusted workers process that committed intent without impersonating a session.
Provider activation remains SIMULATOR only; this is not verified bank settlement.

Pending refunds block new READY/DISPATCH; completed partial refunds may proceed.
Fully refunded orders cannot start fulfillment. An explicit cancellation may restore
stock only while undispatched and fully repaid, preserving paid/refunded history and
snapshotted coupon cancellation policy. Already-dispatched delivery can still be
recorded; money repayment alone never claims a physical return.

## Financial and existing-order continuity after store closure (implementation, 2026-10-31)

Centralize an operational vs financial store-availability intent inside MerchantAccess.
Financial intent is limited to orders.read/orders.manage; it does not grant catalog,
inventory, settings or publication authority. Existing order/financial reads, refunds,
cancellation, private notes, recording delivery and COD collection can survive store
suspension/archive. Starting READY/DISPATCH still requires operational availability.
All paths recheck active verified identity/session, active account, live membership,
role and tenant under the same locks. Suspended accounts gain no exception. Closure
cannot erase receipts or prevent authorized repayment/completion of existing orders.

## Payment-specific transactional notices (implementation, 2026-10-31)

Use a tenant-bound PaymentNotification source for failed/reviewed payment attempts
and refunds without orders; keep the same delivery service, transport and attempt
ledger as identity/order mail. Failure/review notices are cancelled when recovery
makes them stale. Financial messages go to the verified store-customer identity,
not an arbitrary recipient or private merchant reference. No-order refunds keep
per-refund notification identity and exact amounts, even after store closure.
Every simulated message explicitly labels the development payment method. Provider
acceptance remains distinct from inbox delivery; live SES is still unverified.

## Razorpay test-only candidate boundary (implementation, 2026-10-31)

Implement payment/refund ports using a fixed HTTPS Node fetch transport and standard
Node HMAC verification against official SDK-documented paths. No automatic POST retry,
live keys, implicit credentials or runtime provider selection. Store/account-bound
server configuration stays private. Restrict to tested safe-integer INR contracts;
require coherent authoritative captured payment/paid-order state and exact refs/totals.
Browser signatures or webhook status text alone cannot establish capture. Failed
individual attempts do not terminate a still-payable provider order.

This is a candidate, not production-provider approval or verified sandbox settlement.
Owned account configuration, encrypted registry/rotation, ingress/creation-claim wiring,
sandbox checks and security acceptance are activation gates. The default API stays
COD/SIMULATOR. See PAYMENT_PROVIDER_BOUNDARY.md for source, tradeoffs and exact limits.

## Expired upload and tombstone cleanup (implementation, 2026-10-31)

Reclaim only PENDING uploads at least10minutes past their capability deadline and
already-DELETED objects in the selected provider. Complete media remains retained,
including unlinked library assets; references are checked again under account/store/
asset locks through the existing media deletion contract. No financial, identity or
security history is purged and no legal personal-data retention period is adopted.

Commit a tombstone and five-minute fenced retry lease before bounded provider I/O.
Only the current lease can acknowledge accepted deletion; failures stay private and
back off. Recheck accepted tombstones daily for late direct uploads. A local PUT that
finishes after deletion removes its bytes; a concurrent valid completion is preserved.
S3 acceptance does not prove permanent version erasure: private-bucket/lifecycle/version
policies and real provider checks remain deployment prerequisites.
