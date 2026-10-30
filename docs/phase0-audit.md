# Phase 0 audit and verification record

Status: **incomplete — external network prerequisites block required checks**.
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

## Executed results

| Check | Result |
| --- | --- |
| Frozen-lockfile installation | Passed with the final committed-lockfile installation command. |
| Domain/application/memory/config/HTTP unit suite | 16 passed, 0 failed, 0 skipped. Source-level unit tests; not HTTP integration. |
| Production dependency audit | No known vulnerabilities reported by `pnpm audit --prod` at audit time. |
| Database-package TypeScript configuration | Passed independently. |
| Initial SQL migration | Applied successfully to fresh PostgreSQL 17 databases using psql, including final version column. |
| Direct PostgreSQL schema integration | 1 test passed: tenant foreign keys, product/SKU uniqueness, exact 18-digit money, stock/movement checks, transaction rollback. |
| Prisma generation | Failed: network policy returns HTTP 403 for binaries.prisma.sh checksums. Verification was not disabled. |
| Prisma validate/deploy/status/drift | Blocked by the same engine download prerequisite; schema-to-migration equivalence and Prisma migration history remain unverified. |
| API typecheck / production build | Failed: missing generated client and resulting untyped transaction callback. No successful build is claimed. |
| Updated memory API and PostgreSQL adapter suites | Entry commands stopped at the failed build; tests did not execute. Prior foundation tests are not evidence for the changed implementation. |
| GitHub PR/Actions API | HTTP 403 for api.github.com; PR creation and remote Actions execution cannot be verified. |

The SQL migration was authored from the audited schema and directly executed; it
was not generated or verified by Prisma CLI. The pg-based constraint/rollback test
is distinct from the still-unrun Prisma repository tests. Those include a
controlled two-transaction stock race and forced movement-insertion failure.
The updated API suite covers ownership on scoped routes, publication visibility,
uniqueness races, request validation, exact money, public field exclusions,
health/readiness, production refusal and shutdown.

## Remaining review gates

Allow binaries.prisma.sh and api.github.com in environment settings (pending
network draft already saved). Then run the complete documented workflow, diagnose
all failures, verify migration drift/deploy repeatability, create/update the draft
PR, and inspect GitHub Actions results. Do not call Phase 0 complete, deploy,
merge or start Phase 1 until those gates pass and the change is reviewed.

See [setup and deployment prerequisites](setup-and-deployment.md).
