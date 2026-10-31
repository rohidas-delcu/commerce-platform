# Delcu Commerce API

The single NestJS application for merchant, public catalog and scoped customer
APIs. Start from the repository root with Node24/pnpm11.25.0.

- Complete disposable HTTP demonstration: `pnpm demo:backend` or
  `pnpm demo:backend --verify-and-exit`.
- Ordinary development: `pnpm dev:setup`, configure ignored `apps/api/.env`,
  `pnpm db:generate`, `pnpm db:deploy`, `pnpm dev`.
- Swagger `/docs`; OpenAPI `/docs-json`; liveness `/health`; readiness `/health/ready`.
- Real identity and commerce journeys require PostgreSQL. The process-local memory
  adapter is limited to isolated catalog/inventory development. Its legacy demo
  subject header requires explicit development opt-in and never accesses real stores.
- Production runtime is deliberately disabled pending acceptance/security review.
  Simulated money and local email delivery are development behavior, not settlement
  or inbox delivery guarantees. No frontend is included.

Use the current [API contracts](../../docs/BACKEND_API_CONTRACTS.md),
[operations guide](../../docs/setup-and-deployment.md),
[local setup/demo guide](../../docs/LOCAL_DEVELOPMENT.md),
[test guide](../../docs/BACKEND_E2E_TESTING.md) and
[verified status](../../docs/IMPLEMENTATION_STATUS.md).
