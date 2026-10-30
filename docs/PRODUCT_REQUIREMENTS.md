# Product requirements

## Approved direction

Commerce Platform is a long-term, production-oriented, India-first and
global-ready headless commerce SaaS. One authoritative backend will serve future
native storefront and Delcu-generated storefront clients. This repository is the
production-code home; the approved HTML prototype remains a separate design
reference. Future clients/SDKs are product direction, not Phase 0 implementation
approval.

## Phase 0 scope

Complete and verify the existing backend foundation:

- NestJS API in a pnpm/TypeScript monorepo.
- Prisma 7/PostgreSQL persistence plus an isolated development memory adapter.
- Domain and application layers shared by adapters.
- Merchant-owned stores: create, list and publish.
- Store-scoped products: create, list, edit metadata/prices and activate; SKU
  variants and per-store product-handle/SKU uniqueness.
- Inventory: absolute stock adjustments and movement history with atomic writes,
  concurrency protection and rollback on failure.
- Public catalog: published stores and active products only, with explicit public
  field selection excluding SKUs and merchant ownership/internal metadata.
- Reproducible setup/migrations, validation, consistent errors, health/readiness,
  startup/shutdown, safe logging, tests and required GitHub Actions checks.

## Invariants and acceptance

A merchant owns stores; each store owns its catalog and inventory. Scoped APIs
must reject access by another merchant. Money uses exact integer minor-unit
strings, never floating-point prices; store defaults are IN/INR. New stores and
products are drafts. Product activation alone cannot expose an unpublished store.
Stock changes must preserve consistent before/after/delta history. Adapters must
preserve these rules without duplicating application logic.

Demo identity requires `NODE_ENV=development`, explicit opt-in and a valid subject
header. It provides no production identity assurance. Production startup must
refuse until real authentication is designed and reviewed in an approved scope.
All Phase 0 verification gates in `IMPLEMENTATION_PLAN.md` must actually run and
pass; review is required before moving on.

## Exclusions and undecided scope

No React, separate HTML mockup changes, real payments, new business features or
unnecessary microservices in Phase 0. Real merchant identity/RBAC, checkout,
orders, reservations, fulfillment, taxes, subscriptions and other deferred
capabilities are not implemented or approved for the next phase by this document.
Phase 1 scope, authentication provider, production hosting and UI implementation
require explicit future decisions. Do not infer them from roadmap terminology.

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
