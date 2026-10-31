# Delcu Commerce Platform

Headless NestJS modular monolith in a pnpm monorepo, using Prisma7/PostgreSQL17.
Phase0 was merged into main through PR1 (`6b30e82`). The end-to-end backend is in
[draft PR2](https://github.com/rohidas-delcu/commerce-platform/pull/2).

Merchant identity, accounts/membership/onboarding, catalog/images/collections,
stock reservations, scoped customers, carts, shipping/tax/coupons, billing/checkout,
COD and development simulated payments/refunds, orders/manual fulfillment,
notifications and bounded maintenance are implemented. See
[verified status](docs/IMPLEMENTATION_STATUS.md) for current evidence and limits.
Production startup remains disabled; live providers require owned sandbox/security
acceptance. No merchant admin, storefront UI or approved HTML design was changed.

## Run the complete backend demo

Use Node24 and pnpm11.25.0. Docker starts PostgreSQL17 if no configured local server
is available; a running loopback PostgreSQL server needs CREATE DATABASE privileges.

```sh
pnpm install --frozen-lockfile
pnpm demo:backend
# Or execute/assert the whole journey and clean up immediately:
pnpm demo:backend --verify-and-exit
```

The demo applies migrations to its own random database, seeds through real HTTP,
uses private local mail/images and simulated payments, then verifies fulfillment,
stock and history. Interactive mode keeps the API running until Ctrl+C; credentials
are in a private local file, never printed. Existing databases/env files are preserved.
See [local development](docs/LOCAL_DEVELOPMENT.md) and
[operations](docs/setup-and-deployment.md) for ordinary persistent development.

Swagger is `/docs`, OpenAPI JSON `/docs-json` on the running loopback API.
[API contracts](docs/BACKEND_API_CONTRACTS.md),
[lifecycles](docs/COMMERCE_LIFECYCLES.md) and
[test guide](docs/BACKEND_E2E_TESTING.md) describe supported behavior.

## Continue or review

Read [AGENTS.md](AGENTS.md), [status](docs/IMPLEMENTATION_STATUS.md),
[requirements](docs/PRODUCT_REQUIREMENTS.md), [architecture](docs/ARCHITECTURE.md),
[plan](docs/IMPLEMENTATION_PLAN.md), [decisions](docs/DECISIONS.md) and
[design reference boundary](docs/DESIGN_SYSTEM.md). Keep exact money strings,
tenant isolation, transaction boundaries and the single backend. Never use demo
headers for real merchant authority. No automatic merge or production deployment.
