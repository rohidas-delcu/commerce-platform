# Architecture

## Repository and boundaries

| Location | Responsibility |
| --- | --- |
| `apps/api/src/domain` | Commerce types, errors, money/handle/SKU and stock invariants; no Nest/Prisma dependencies. |
| `apps/api/src/application` | Use cases and repository port; ownership checks, publication and public DTO selection. Uses Nest injection. |
| `apps/api/src/http` | Nest controllers, demo guard, validated request DTOs, consistent error envelope and health routes. |
| `apps/api/src/infrastructure` | Memory and Prisma/PostgreSQL implementations of the same repository port. |
| `apps/api/src/config` | Runtime configuration validation and sanitized logging. |
| `packages/database` | Prisma schema, committed SQL migrations and typed CLI configuration. |
| `.github/workflows/ci.yml` | Required unit, database, integration, migration and compilation checks. |

HTTP controllers call application services through the single backend. Domain
rules remain centralized; adapters implement persistence-specific constraints and
atomicity. The database workspace is shared schema/tooling, not a separate
runtime service. Root scripts orchestrate the three private workspace projects.

## Persistence and consistency

Store → Product → ProductVariant; InventoryMovement references its store and
variant through tenant-consistent foreign keys. Unique constraints cover store
handles, product handles per store and SKUs per store. Product metadata uses an
optimistic version so stale saves cannot undo newer edits or activation.

PostgreSQL stock adjustment reads stock, conditionally updates it against that
value and inserts the movement in one transaction. A losing update returns a
conflict. SQL CHECK constraints additionally protect money, stock and movement
arithmetic/reasons. Preserve them in later migrations; Prisma drift checks alone
cannot verify these checks.

Memory state is per repository instance/process with defensive copies. Creation
checks do not yield before insertion; metadata saves preserve current stock and
check versions. It is a development adapter, not durable production storage.

## Runtime and trust boundary

`DATA_DRIVER` selects the adapter. Prisma client output is generated under the
API's ignored `src/generated/prisma` and compiled as ESM; schema generation is a
build prerequisite. Nest/TypeScript use NodeNext with decorator metadata and
refuse emission on compilation errors.

The API binds to loopback. `/health` is liveness; `/health/ready` checks repository
readiness. PostgreSQL initializes before listening; shutdown hooks disconnect the
pool. Demo identity remains development-only and production refuses startup.
Public responses explicitly select fields; HTTP errors share
`{statusCode, code, message}` and unexpected errors/logs omit sensitive details.

Clean compilation and memory/PostgreSQL integration now pass locally. See
`IMPLEMENTATION_STATUS.md` for exact evidence, remote CI and the pending review
gate. Production deployment is not authorized.

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

## MerchantAccess implementation checkpoint

MerchantAccess has domain permission policy, application use cases, PostgreSQL
transaction adapter and authenticated HTTP controller. It reuses CommerceService
with a scope-bound authorization port and transaction-bound CommerceRepository;
no second set of catalog/inventory rules exists. Lock order is identity/session,
account, store. Membership mutations share account/store locks with commerce
writes so authority is rechecked at commit scope. Invitations and membership
rows use compound tenant FKs. Legacy stores are backfilled to unmapped quarantined
accounts without touching commerce IDs or creating identity memberships.

## Store customer identity isolation

Reuse IdentityAuthorityPort, IdentityService and scoped IdentityRepositoryPort
factories for first-party credential/session rules. Identity rows are distinct per
namespace: `merchant` or `store:<UUID>`, each with its own email uniqueness. Customer
rows have a non-null customerStoreId FK; merchant rows have null. Namespace is
immutable and constrained to that FK. Session identity/scope is a composite FK.
This shares security machinery, never a customer account's merchant permissions.
Merchant membership/invitation/creation triggers require a merchant identity.

CustomerService depends on ports; concrete scoped repositories/Argon2/secrets are
wired in AppModule. Scoped identity repositories share the root connection pool.
Customer addresses/wishlist transact with identity/session, account and store locks,
rechecking revocation and publication before access. Transactional customer APIs
require PostgreSQL; there is no permissive memory authentication fallback. Cookies
are host-only, named per store; a future custom-domain storefront uses a same-origin
proxy/BFF with its own host cookie, rather than a cookie shared across unrelated domains.
CORS enables credentials only for the validated explicit origin allowlist.

Customer guards/transaction scopes distinguish `account` from `commerce` availability.
Authentication, own addresses and receipts may survive closure for an already-used
managed namespace. Signup, catalog/wishlist content, carts and checkout require an
active published store. Both paths retain the same scoped identity/session checks;
no demo or merchant identity becomes customer authority. Unused closed namespaces
remain hidden. Availability intent is static use-case metadata and centralized policy.

## Notification delivery

NotificationService formats approved identity/order projections through ports;
PrismaNotificationRepository owns queue leases, attempt history and acknowledgements.
DevelopmentMailer provides a private local mailbox; SesMailer implements an official
SDK adapter boundary. Transactional intent creation is independent of transport
availability, so a notification outage cannot undo an order. An optional in-process
worker drains bounded batches with up to five concurrent sends and awaits active
work during shutdown. Trusted CLI `pnpm worker:once` runs the same service without
exposing an HTTP delivery endpoint. Global production startup refusal still applies.

## Trusted maintenance

OperationsModule exposes MaintenanceService through a repository port. The optional
in-process worker runs bounded expiry before mail; one-shot CLI supports `maintenance`
and an optional store UUID. Request and worker paths share checkout/cart lifecycle
helpers and the inventory transition implementation. Work acquires account/store
locks and rechecks due resources, without acquiring or impersonating an identity
session. Closed stores remain eligible. Each job is atomic; other jobs survive a
failure. New scan indexes cover global reservation deadlines and expired mail leases.

## Payment checkpoint

PaymentService coordinates a repository port and PaymentPort; development simulation
is a separate optional capability. DevelopmentPaymentSimulator persists provider state/
events through its own adapter. PaymentAttempt/PaymentObservation preserve exact money,
source version/hold and scoped receipt identity. Provider observations commit before
order finalization. Shared `place-checkout.ts` validates and commits both COD and verified
payment orders; there is no duplicated tax/stock/order-placement implementation.

Trusted reconciliation locks customer identity → account → store → checkout → payment,
aligning with authenticated requests without impersonating a session. The worker runs
expiry, payment reconciliation and notification delivery in sequence, with no overlapping
batches. Unknown/late/mismatched results never become unconditional order placement.

Manual refunds use a RefundRepositoryPort on the same transaction-bound commerce
repository supplied by MerchantAccess. Existing centralized orders.manage/ orders.read
policy controls mutation/read; controllers do not define independent role logic.
The immutable ledger, gross cash and refunded balance are separate. Customer receipts
expose totals/status and an approved refund event, excluding the merchant's private
cash-return reference. Memory mode explicitly refuses financial records.

RefundService coordinates a RefundProcessingPort and RefundProviderPort, with an
optional development simulation capability. MerchantAccess creates scoped intents
through the existing commerce subport. Processing locks the recorded merchant actor,
account/store, captured payment/order and refund in a consistent order. A durable
provider observation is separate from final financial commitment; its failure cannot
erase already-observed money movement. The existing ledger supports manual and
simulated refunds, with tenant FKs, immutable source fields and deferred balance/receipt
checks. The worker now runs expiry, payment/refund reconciliation and mail sequentially.

MerchantAccess now distinguishes store availability intent from identity/account/role
authority. Financial intent permits closed-store existing-order/finance work while
retaining every account/session/tenant check. A central domain whitelist selects
terminal order commands; normal commerce defaults remain operational. No caller can
select financial availability through a request body or identity header.
