# Phase 0 audit and verification record

Status: **local and remote technical verification passed; human review pending**.
The complete committed foundation was inspected, including workspace manifests,
lockfile resolution, CI, TypeScript/Nest configuration, schema, both adapters,
domain/application layers, HTTP controllers/DTOs, tests and setup documentation.
No frontend, payment or additional service implementation was added.

## Audit findings and changes

- pnpm has three private workspace projects; the lockfile is committed. Prisma CLI,
  client and PostgreSQL adapter resolve to 7.10.1; Nest resolves to 12.3.2 on Node 24.
  Added database-package typechecking and explicit tooling declarations.
- Memory product creation yielded between uniqueness checks, allowing racing
  requests to reuse handles/SKUs. Checks and insertion are now synchronous within
  the repository operation; regression tests cover both races.
- Memory metadata saves replaced variant snapshots and could revert newer stock.
  Saves now retain current inventory. Product metadata/activation also use an
  optimistic version in both adapters to prevent stale saves reverting changes.
- Optional PATCH fields accepted null even where application code calls trim.
  Only compare price accepts null for explicit clearing; other optional fields
  validate when present. Domain, validation, auth and unexpected errors now share
  one response envelope; unexpected details are hidden.
- Missing migrations and insufficient tenant linkage in inventory history were
  corrected with an initial SQL migration, composite variant/store references and
  database checks for money, stock, movement arithmetic and reason values.
- Environment values now validate before startup. Added repository readiness,
  database initialization checks, bounded connection establishment, cleanup on
  failed startup, shutdown checks, and sanitized JSON logs.
- Memory data is per instance/process with defensive copies. History reads now
  match PostgreSQL's 200-entry limit. Production startup refuses to run; demo auth
  still requires explicit development mode, opt-in and a valid subject header.
- CI now triggers on the foundation branch as well as PRs/main and provisions
  PostgreSQL. It requires schema/client generation, migration deployment twice,
  migration status/drift, unit tests, typechecking, build, memory API integration,
  and PostgreSQL API/repository/schema integration. Failure stops the job.

## Generator-path defect and verification follow-up

Failed run [41032673250](https://github.com/rohidas-delcu/commerce-platform/actions/runs/41032673250)
validated/generated Prisma, applied/repeated migrations, checked drift and passed
16 units, then failed typechecking. Its metadata was independently inspected.
The generator had four parent segments from the schema directory, escaping the
checkout. Three segments correctly target `apps/api/src/generated/prisma`.
Corrected implementation: `f84f71767e97a9e3f599d4a01f43dd7832f15f32`.
CI now asserts the generated client location; no generated files were copied,
tracked or used through type suppression.

## Current executed results

All local technical gates now pass on the corrected implementation:

| Command | Actual outcome |
| --- | --- |
| Frozen-lockfile installation | Passed on Node 24.19.0 / pnpm 11.25.0; no lockfile changes. |
| `pnpm db:validate` / `pnpm db:generate` | Passed; client generated within API source and compiled normally. |
| `pnpm db:deploy` twice on fresh PostgreSQL database | Initial migration applied; repeat reported no pending migrations. |
| `pnpm db:status` / `pnpm db:drift` | Up to date / no difference detected. |
| `pnpm test:database` | 1 passed: tenant foreign keys, product/SKU uniqueness, money precision, stock/movement constraints and rollback. |
| `pnpm test` | 17 passed, 0 failed/skipped (domain/application/memory/config/HTTP units). |
| `pnpm typecheck` / `pnpm build` | Both passed, including database configuration and API. |
| `pnpm test:integration` | 4 passed, 0 failed/skipped. |
| `DATABASE_URL=<disposable URL> pnpm test:postgres` | 8 passed, 0 failed/skipped, including controlled concurrency and forced movement-insertion rollback. |

The disposable database was `commerce_phase0_verified`. Initial SQL was authored
from the audited schema previously; Prisma has now applied that committed migration
and verified repeat deployment/status/drift. Direct constraint tests complement
Prisma equivalence checks. The old network and compilation blockers are resolved.

Added coverage demonstrates same-owner cross-store isolation while permitting
identical product handles/SKUs in different stores, readiness failure sanitization,
invalid configuration/unavailable database startup refusal, production refusal,
and graceful shutdown. Existing tests verify ownership, publication, safe errors,
public field projection, exact money, memory isolation and optimistic metadata.

An initial local memory run was invalidated by simultaneous builds deleting the
shared output. The suites were rerun sequentially and passed. This was a command
orchestration error, not a weakened test or application workaround.

## CI and review gate

Corrected-code run: https://github.com/rohidas-delcu/commerce-platform/actions/runs/41046787135
Conclusion: **success**; every required verification step passed. Draft PR: https://github.com/rohidas-delcu/commerce-platform/pull/1

GitHub run metadata/PR APIs work. Raw log download from the Actions storage host
was denied; this did not block local checks or metadata inspection. Verify the
latest branch run before review. No architecture or business scope changed.
Human Phase 0 review is still required. Do not merge, deploy or start Phase 1.
See [implementation status](IMPLEMENTATION_STATUS.md) for next task and
[setup/deployment prerequisites](setup-and-deployment.md) for reproduction.

### Subsequent backend billing verification (2026-10-31)

Phase0 remains merged; subsequent backend work is draft PR2. Cleanup predecessor
f123d30 passed Actions https://github.com/rohidas-delcu/commerce-platform/actions/runs/41172855548.
Billing migration27 was deployed and its populated upgrade rehearsal executed:
original financial/order columns remain identical, older billing stays explicitly
uncollected, deploy repetition/status/drift pass. Real HTTP/PG COD/SIM receipts,
resume/reset, tenant privacy, payment guards and immutable billing tests passed.
Current full regression evidence is maintained in IMPLEMENTATION_STATUS.md.
