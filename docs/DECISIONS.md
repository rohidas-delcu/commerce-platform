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
