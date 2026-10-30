# Implementation plan

## Phase 0 — backend foundation (active, incomplete)

Source import and hardening are committed. Remaining work is verification and any
fixes those checks demonstrate, within the approved foundation scope.

1. Restore usable access to `binaries.prisma.sh` and `api.github.com`; preserve
   checksum/TLS verification and existing Git authentication. Settings saved in a
   prior environment are not proof they are applied in the current environment.
2. From the repository root install with the committed lockfile; validate the
   schema and generate Prisma. Fix actual generation/compilation failures.
3. On a fresh disposable PostgreSQL database, run `db:deploy` twice, `db:status`
   and `db:drift`. Verify migration/schema equivalence and SQL constraints; do not
   treat earlier direct psql application as Prisma migration verification.
4. Execute domain/application/config/HTTP/memory unit tests, direct SQL tests,
   memory API integration, PostgreSQL API/repository integration, full TypeScript
   checks and production build. Investigate every failure. In particular verify
   concurrent stock updates, forced rollback, tenant isolation, uniqueness,
   publication, precision, data exposure, validation, auth and lifecycle behavior.
5. Create/update a **draft** PR to `main`, inspect remote GitHub Actions results,
   and update continuity documents with exact evidence and commit/PR references.
6. Stop for review. Do not merge automatically or start Phase 1.

Commands, environment prerequisites and disposable database guidance are in
`setup-and-deployment.md`. Current results and exact next task are in
`IMPLEMENTATION_STATUS.md`.

## Phase 0 exit gate

All required checks execute successfully on the relevant revision; migration
history, repeatability and drift are verified; security/lifecycle findings are
resolved or explicitly reviewed; required remote CI is verified; documentation
matches the implementation; the draft PR is available for review. Code presence,
a successful install or source-level unit tests alone cannot satisfy this gate.

## Phase 1 and later — not authorized

No implementation sequence or feature set has been approved here. After Phase 0
review, obtain explicit scope before proceeding. Future product direction is
recorded separately from authorization in `PRODUCT_REQUIREMENTS.md`.
