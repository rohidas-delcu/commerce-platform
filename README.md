# Commerce Platform

India-first, global-ready headless commerce SaaS. This monorepo is the production-code home for the NestJS API, future merchant admin and storefront clients, and the Delcu storefront SDK. The approved HTML prototype remains a separate design reference.

## Status

**Milestone 1 foundation**: store provisioning/publication, catalog and SKU variants, inventory adjustments and movement history, public storefront reads. The API supports a process-local demo data adapter and a Prisma/PostgreSQL adapter. **Not production ready:** merchant authentication, checkout, payment processing, subscriptions and fulfillment are intentionally out of scope.

The first PR includes a CI workflow for dependency installation, Prisma client generation, domain tests, typecheck and build. Runtime integration checks cover the store, product, inventory, ownership, and demo-auth flows; PostgreSQL checks require a running database.

## Local setup

Requirements: Node.js 24, pnpm, and PostgreSQL for persistent mode.

```sh
cp .env.example apps/api/.env
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @commerce/api dev
```

Demo API: set `NODE_ENV=development`, `DATA_DRIVER=memory` and `DEMO_AUTH_ENABLED=true`. The demo merchant principal is identified by `x-demo-subject-id: demo-merchant`. Sample store `northline-goods` is seeded in memory. Data resets when the process restarts.

Postgres: set `DATA_DRIVER=postgres`, `DATABASE_URL`, then run `pnpm db:generate` and `pnpm db:deploy`. Demo authentication remains strictly a local/testing mechanism. A production-grade authentication provider is required before deployment.

Domain invariants (Node.js 24; no package install required):

```sh
node --test apps/api/test/domain.test.mjs
```

See [API README](apps/api/README.md) for endpoints and the remaining verification gates.

## Important rules

- One authoritative commerce backend is shared by the native storefront and Delcu-generated storefronts.
- A merchant account owns stores; each store owns its catalog, inventory and orders.
- Every merchant write is scoped to the authenticated merchant; no browser token can access merchant APIs.
- Money uses minor-unit decimal strings, never JavaScript floating-point prices.
- The memory adapter is for development only and cannot run in production.
- Storefront UI and the full order/payment lifecycle will be migrated and implemented in later milestones.

## Phase 0 verification

See [audit and actual verification results](docs/phase0-audit.md) and
[setup, migrations, operations and deployment gates](docs/setup-and-deployment.md).
Phase 0 local technical checks pass; see implementation status for remote CI
and the human review gate. No automatic merge or production deployment is authorized.

## Continuing development

Start with [AGENTS.md](AGENTS.md) and the
[implementation status](docs/IMPLEMENTATION_STATUS.md). The version-controlled
[requirements](docs/PRODUCT_REQUIREMENTS.md), [architecture](docs/ARCHITECTURE.md),
[phase plan](docs/IMPLEMENTATION_PLAN.md), [design reference status](docs/DESIGN_SYSTEM.md)
and [decision log](docs/DECISIONS.md) preserve scope and handoff context across agents.
