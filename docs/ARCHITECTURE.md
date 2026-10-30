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

This describes committed implementation intent, not proof of runtime correctness.
See `IMPLEMENTATION_STATUS.md`: clean compilation and changed API/Prisma-adapter
integration remain unverified. Production deployment is not authorized.
