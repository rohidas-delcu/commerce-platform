# Backend delivery report — 2026-10-31

The self-contained merchant-to-delivery backend works through real HTTP/PostgreSQL
with COD or explicitly labeled development simulation. Phase0 is merged on main;
new backend work is draft PR2 on feature/commerce-backend-end-to-end. Review is
required. No frontend, approved HTML modification, automatic merge or deployment.
Latest source SHA and exact remote Actions provenance are in IMPLEMENTATION_STATUS.md.

## Modules and journeys

| Delivered | Behavior |
| --- | --- |
| Identity | First-party maintained Argon2id; merchant/store-customer namespaces, verification/recovery, profile/password, opaque rotating sessions, revocation, Origin/CSRF, database throttles and safe audit. IdentityAuthorityPort remains replaceable. |
| MerchantAccess | Multi-account/store membership, central roles, invitations, immediate revocation, last-owner protection, versioned/resumable onboarding, locale/contact/branding/pricing gates, publish/unpublish/suspend/archive. Legacy owners quarantined, never claimed automatically. |
| Catalog/media | Product/variant lifecycle, SEO/options/exact prices/scoped handles/SKUs, search/filter/sort/pages, ordered/featured collections, verified local image uploads, S3 boundary, branding/tenant/public safeguards. |
| Inventory | On-hand/reserved/available, atomic adjustments/movements, bounded holds/expiry/release/commit, last-unit concurrency and explicit cancellation restoration. |
| Customers/cart | Scoped accounts/addresses/default/wishlist/history; guest capabilities, owned carts, quantity/availability/price refresh, versioning, merge/retry, expiry and coupon application. |
| Pricing/checkout | Configured zones/flat/free shipping, typed tax inclusion/exclusion and exact rounding, coupon quotas, durable resumable checkout, shipping/billing, authoritative quote, immutable order totals and provenance. |
| Payments/refunds | COD DUE then separate actual collection assertion; durable simulator success/failure/timeout/delayed/out-of-order/retry; capture observation before order finalization; exact manual COD/simulated refunds with pending budget and immutable ledger. |
| Orders/fulfillment | One logical order per checkout, per-store number, safe customer history, authorized merchant searches/pages, ready/dispatch/delivery, cancellation, internal notes and immutable events; closed-store finance retains live authority. |
| Notifications/operations | Transactional identity/order/payment outbox, private local mail, SES SDK boundary, bounded leases/retries/unknown safety, expiry/reconciliation/media cleanup and graceful shutdown in the same monolith. |

Executed journeys include merchant signup/verification→onboarding/catalog/images→
publication; public collection discovery→guest cart→customer login/merge/address→
billing/checkout→simulated paid order→dispatch/delivery/history/stock; separate real
HTTP COD/collection, failure/timeout/expiry/late capture/refunds/cancellation, last-unit
competition, role/session revocation, tenant denial and forced rollback scenarios.

## Persistence and contracts

27 additive committed SQL migrations under packages/database/prisma/migrations.
Entities cover identities/sessions/challenges/audit/outbox; accounts/memberships/
invitations/stores; products/variants/collections/media; inventory holds/movements;
customer addresses/wishlist; carts/lines; pricing/coupons/leases/redemptions; checkout;
orders/items/commands/events; payment attempts/observations/simulator events; refund
intents/observations/ledger and notification attempts. Tenant FKs, uniqueness, money/
stock/financial CHECKs and immutable history protect the application boundary.
Migration rehearsal preserves original IDs/commerce/credentials/sessions and every
pre-billing order column. Older billing is explicitly LEGACY_NOT_COLLECTED/null.
No reset, financial trigger bypass or lossy invented backfill.

APIs: /v1/auth, /v1/merchant, /v1/storefront/:handle, scoped customer/auth/cart/
checkout/payment/order endpoints and verified media. Legacy /v1/admin is development
impersonation only. Gateway ingress stays disabled. Detailed method/body/status/
idempotency contracts: BACKEND_API_CONTRACTS.md; live Swagger /docs, JSON /docs-json.
Merchant lists now use page envelopes; update any clients of the earlier unmerged
array responses. Search offsets are bounded0–10000. Money is minor-unit strings.

## Executed acceptance

- Frozen lockfile install and production dependency audit: passed; no known reported vulnerabilities.
- Prisma validation/generation: passed with API-local generated client.
- Fresh migration deployment/repetition/status/drift and populated preservation: passed,27 migrations.
- Unit tests64/64; memory HTTP4/4; PostgreSQL33/33; no failed/skipped cases in final runs.
- Typechecking and production artifact build: passed. Production startup remains refused.
- Complete demo: passed against existing PG and auto-provisioned Docker PG, including
  private worker mail and cleanup. Additional OpenAPI request/query assertions passed.
- GitHub Actions conclusion/URL and exact SHA: see IMPLEMENTATION_STATUS.md, updated after push.

Tests exposed and fixed null-address handling, upload races, uncertain simulator
refund rollback, payment-finalization rollback recovery, financial closure authority,
configuration readiness and truncated merchant lists. Deliberate forced-failure tests
emit sanitized error events and verify no partial business state. Counts are cases,
not exhaustive proof of every possible interleaving. See BACKEND_E2E_TESTING.md.

## Run locally

Node24/pnpm11.25.0, Docker or loopback PostgreSQL17 with CREATE DATABASE privileges:

```sh
pnpm install --frozen-lockfile
pnpm demo:backend --verify-and-exit
# Keep an isolated seeded API running until Ctrl+C:
pnpm demo:backend
```

No production credentials. Own random DB, deterministic catalog/scenario content,
random private credentials, actual HTTP and private local files. Only owned random
DB/files drop; existing databases/env files/container are preserved. Local setup,
private credential location and ordinary persistent mode: LOCAL_DEVELOPMENT.md.

Sanitized examples (UUID/cookie/CSRF placeholders, never actual credentials):

```http
GET /v1/storefront/delcu-trail-supply/products
```

```http
PATCH /v1/storefront/delcu-trail-supply/customer/checkouts/<checkout-uuid>
Origin: http://localhost:5173
Cookie: <private-store-customer-cookie>
x-csrf-token: <private-session-csrf>
Content-Type: application/json

{"expectedVersion":1,"billingSameAsShipping":true}
```

```http
POST /v1/storefront/delcu-trail-supply/customer/checkouts/<checkout-uuid>/payments
Origin: http://localhost:5173
Cookie: <private-store-customer-cookie>
x-csrf-token: <private-session-csrf>
Idempotency-Key: example-payment-v1
Content-Type: application/json

{"expectedVersion":3,"method":"SIMULATOR","scenario":"SUCCESS"}
```

The executed demo confirmed DLC-00000001, INR209800 minor units, PAID, due0,
DELIVERED/COMPLETED, stock11 from12 and one customer order after payment retry.
Simulation is not bank capture. Versions/UUIDs depend on preceding real API responses;
the executable script is the authoritative runnable sequence.

## External requirements and outstanding review

| Gate | Actual state / required evidence |
| --- | --- |
| Razorpay | Candidate transport/HMAC/authoritative lookup/scoped receipt contracts tested with fakes and PG. No real sandbox call, runtime gateway selection, credential registry or webhook ingress enabled. Provider adoption/MoR, owned merchant/test credentials, creation-claim/ingress wiring and sandbox/security acceptance required; see PAYMENT_PROVIDER_BOUNDARY.md. |
| S3 | SDK signing/checksum/delete contracts tested; local bytes exercised. Owned private bucket/IAM/browser CORS/version/lifecycle roundtrip and erasure semantics not verified. |
| SES | SDK contract tested; local mail delivered to private files. Owned verified sender/region/recipient sandbox, real delivery and bounce/complaint handling not verified. No silent fallback. |
| Production/security | Runtime refuses production. Independent authentication/authorization/financial/concurrency review, real-browser/BFF cookie acceptance, TLS/secrets/least-privilege role/public search_path, migration rollout and backup/restore/monitoring needed. |
| Legal/policy | No tax/legal compliance or financial/PII retention policy invented. Complete assets/financial/audit history retained. Cross-account legal ownership transfer/operator recovery remain disabled. |

No local failing checks are known at this checkpoint; owned provider and release
acceptance remain genuine external limits. Stop after backend delivery for review.
UI work is a separate future authorization; do not merge or deploy automatically.
