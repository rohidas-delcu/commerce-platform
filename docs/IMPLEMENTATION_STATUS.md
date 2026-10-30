# Current backend implementation status — 2026-10-30

**End-to-end mission IN PROGRESS, not complete.** User authorizes continuing
verified backend slices without per-slice permission. No merge, deployment or UI.
Branch: `feature/commerce-backend-end-to-end`, based on merged main `6b30e82`.
Scope: BACKEND_REQUIREMENTS.md. Historical proposal-only scope is superseded.

## Inventory reservation checkpoint

On-hand stock now carries a separate reserved counter; public availability uses
on-hand minus reserved. Durable multi-line holds have stable store-scoped keys,
input digests, bounded TTL, lifecycle events and composite tenant foreign keys.
Reserve/release/expire operations have merchant HTTP APIs; the internal commitment
use case atomically consumes stock and creates movement records exactly once.
Order linkage/cancellation restoration and automatic expiry scheduling remain for
checkout/orders/worker slices. This checkpoint does not claim orders exist.

Actual current runs: `pnpm test` 29 passed; `pnpm typecheck` passed; build passed
through both integration commands; `pnpm test:integration` 4 passed;
disposable PostgreSQL `pnpm test:postgres` 13 passed; `pnpm test:migrations` passed
(populated upgrade, repeat/status/drift and byte-identical original values).
No skipped tests. New coverage executes last-unit competition, hold-key retry,
commit/release race, multi-line rollback, SQL tenant/check constraints, forced
movement failure rollback, and expiry after waiting on a PostgreSQL row lock.
Initial implementation/test failures were corrected and the full suite rerun.
Migration `20261030144000_inventory_reservations` is additive; extends the existing
movement reason CHECK without modifying historical rows or the original migration.
Media commit `693c0203c99ce04f9bace12d5ebe120d6c3c7425` passed Actions:
https://github.com/rohidas-delcu/commerce-platform/actions/runs/41059745083
Exact next task: store-scoped customer credentials/sessions, addresses and wishlist,
then carts, pricing/settings, checkout, payments, orders/fulfillment and workers.

## Media checkpoint

Media slice verifies PNG/JPEG raster decoding, SHA-256/size/type, immutable local
uploads, bounded 15-minute reservations, ordered/primary/alt-text product images,
optimistic image replacement and referenced-asset deletion protection. Public reads
require a published available store and an active linked product; object keys and
capabilities remain private. S3 uses SDK presigned PUT and verified GET checksums.
No live S3 request has been verified. Bucket/CORS/IAM/lifecycle setup and sandbox
verification remain external release prerequisites. Expired-upload/orphan cleanup
still needs the operations worker; tombstones prevent public exposure on failures.

Executed on this source: `pnpm test` 26 passed; `pnpm typecheck`, `pnpm build`
passed; disposable PostgreSQL `pnpm test:postgres` 10 passed; populated Phase 0
`pnpm test:migrations` passed. No failed/skipped tests in those runs. Migration
`20261030143000_media_assets` is additive; original migration unchanged.
Collections commit `fb84e8d` CI succeeded:
https://github.com/rohidas-delcu/commerce-platform/actions/runs/41057783594
Current media commit/CI: see latest branch history/run; not yet remotely verified
at the time this checkpoint was written. Draft PR #2 remains open.
Exact next task: inventory reservation/release/expiry/commit concurrency slice,
then customer identity, carts, pricing, checkout, payments, orders and fulfillment.

## Verified slices

1. Identity core, commit `1defee9fd889ea5c00bf74e393112677ed6dbde9`, pushed.
   Actions https://github.com/rohidas-delcu/commerce-platform/actions/runs/41051657063
   succeeded. Argon2id, verification/recovery, session/CSRF, rotation/replay,
   current/all-device revocation, PostgreSQL throttles, encrypted development mail.
2. MerchantAccess/onboarding checkpoint: accounts, explicit memberships, fixed
   permission policy, invitations, acceptance/revocation, role changes, last-owner
   concurrency protection; session-authenticated store/catalog/inventory APIs.
   Store creation is idempotent; onboarding saves/version checks/resume, locale/
   timezone/contact/branding-name validation, complete vs publish separation,
   unpublish, store/account suspension/resume and non-destructive archival.
   Identity deactivation blocks last owners; safe cases revoke memberships/sessions.
   Sole-owner suspension freezes the account for audited operator recovery.
   Legacy rows are attached to quarantined accounts with NO login memberships.
   Demo headers cannot access real merchant-managed stores.

## Actual checkpoint verification

- `pnpm test`: 24 passed, 0 failed/skipped.
- `pnpm typecheck`, `pnpm build`: passed.
- `pnpm test:integration`: 4 passed, 0 failed/skipped.
- Disposable DATABASE_URL + `pnpm test:postgres`: 10 passed, 0 failed/skipped on the fresh migrated database.
- Merchant HTTP test includes real signup/verification/login, account/store,
  onboarding, product activation, inventory, publication, invitations and roles,
  wrong-store/account access, demo-header rejection and last-owner races.
- Controlled PostgreSQL revocation-lock test passed: a blocked catalog mutation
  rechecks revoked membership after lock release and inserts nothing.
- Empty DB deployment/repeat/status/drift passed. `NODE_ENV=test DATABASE_URL=...
  pnpm test:migrations` passed: creates its own disposable populated Phase 0 DB,
  upgrades/repeats/status/drift, verifies every original commerce value/ID and
  quarantines without granting memberships, then removes only its own fixture DB.
- New migrations: `20261030130000_merchant_access`,
  `20261030131000_owner_suspension`. Original Phase 0 migration unchanged.
- Record latest verified slice SHA via `git log -- apps/api/src/merchant` and PR/CI
  after pushing; source edits and local success alone do not establish remote CI.

## Current limitations / exact remaining tasks

- Not complete: onboarding shipping/payment settings and logo/assets, complete cursor pagination and live storage verification, reservation inventory,
  store-scoped customer auth/addresses/wishlist, cart/merge, shipping/tax/discount
  quotes, checkout and authoritative snapshots, COD/simulator/Razorpay boundary,
  orders/refunds/manual fulfillment/history, shared notification delivery retries
  and SES, full executable demo and E2E flows A–J.
- Real authentication is now available at `/v1/merchant`; `/v1/admin` remains
  development-only legacy demo API. Production still refuses startup. Do not lift
  this until complete acceptance/security gates pass.
- Quarantined legacy public catalog reads retain prior development behavior;
  production ownership cutover remains disabled. Unknown real owners need reviewed
  mapping, never automatic reassignment to signup identities.
- Email currently stages encrypted development payloads; no live SES verification.
  Live S3/SES/Razorpay require owned provider accounts/credentials and sandbox tests.
- Account/store legal ownership transfer across accounts is disabled (no endpoint).
  Account recovery from RECOVERY_REQUIRED needs audited operations; no insecure
  self-service bypass or auto-promotion. Pricing/tax legal compliance not claimed.
- Lists currently bounded at 100; cursor pagination and complete settings/contracts
  remain work. Shipping/payment settings are not yet publication prerequisites.
- Browser acceptance, rate/retention cleanup, breach-password policy, full security
  review and complete demo remain production release gates.

Product lifecycle slice now provides product detail, explicit DRAFT/ARCHIVED
transitions, SEO metadata, search/legacy collection filter, exact-price sorting,
bounded offset pagination and safe public detail/projection. Unit 22, memory 4,
PostgreSQL 10 and populated upgrade rehearsal passed; typecheck/build passed.
Migration `20261030140000_product_lifecycle` preserves original column values.
PR #2 https://github.com/rohidas-delcu/commerce-platform/pull/2 is open/draft.
Latest product implementation commit: `563536d`. Swagger DTO metadata generation
and cookie/CSRF documentation are also now covered by executed HTTP checks.
MerchantAccess commit `3bd8d8d` CI run 41054319257 succeeded in every required step.

Variant metadata slice adds activation, price/compare overrides and validated
string options. New variants start with zero stock; metadata cannot write stock.
Concurrent last-active-variant deactivation is rejected and metadata saves retain
stock. Domain policies are shared by memory and PostgreSQL. Migration
`20261030141000_variant_metadata` supplies defaults preserving old rows and price/
JSON constraints. Unit 23 and PostgreSQL 10 tests, build/typecheck and populated
upgrade rehearsal passed. OpenAPI commit `f1f1637` latest CI run 41055678678 passed.

Collections now provide create/edit/archive, featured and position ordering,
versioned product link/unlink/reorder, administrative product lists and public
listing/detail with only active products. Composite tenant FKs reject cross-store
links. Memory and PostgreSQL use the same application/domain contracts. Migration
`20261030142000_collections` preserves legacy free-text collection metadata.
Unit 24, PostgreSQL 10, build/typecheck and populated migration rehearsal passed.
Variant commit `6e3bc3f` CI run 41056429285 succeeded. Collections CI to verify after push.

Exact next task after verifying/pushing this checkpoint: implement media upload reservation/completion, safe image verification and
product image ordering/primary selection through development storage and the S3
adapter boundary. Product/variant lifecycle and normalized collections are now
implemented, with bounded offset pagination; full cursor pagination remains pending. Then
continue inventory reservations, customer/cart/pricing/checkout and order/payment/
fulfillment slices automatically. Do not stop at a plan or infer whole completion.

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
