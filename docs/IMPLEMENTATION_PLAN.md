# Implementation plan

## Phase 0 — backend foundation (technical checks passed; human review pending)

Source import, hardening and the generator-path fix are committed. Local and corrected-code remote checks
below have passed; obtain human review and check the latest branch CI. Preserve
this checklist for reproducing the evidence in another environment.

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
