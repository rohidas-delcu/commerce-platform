# Decision log

Record approved decisions with context, consequences and evidence. Distinguish
implementation choices from verified behavior. Append or explicitly supersede
entries when decisions change; do not silently rewrite approval history.

| ID | Decision | Context and consequence |
| --- | --- | --- |
| D001 | One authoritative commerce backend; modular monorepo, no unnecessary microservices. | Approved long-term direction. Keep domain/application boundaries and avoid duplicated business logic across clients/adapters. |
| D002 | NestJS, TypeScript/NodeNext, pnpm workspaces, Prisma 7 and PostgreSQL; development memory adapter. | Imported foundation stack retained. Database workspace owns schema/migrations; generated ESM client belongs to API. Resolved/pinned tooling is in manifests/lockfile. |
| D003 | Store-scoped ownership and uniqueness; exact minor-unit money strings. | Approved foundation invariants. Public catalog explicitly selects safe fields; money does not use floating point. |
| D004 | Demo identity is development-only; production startup refuses. | No real merchant authentication is implemented. Headers permit impersonation. A production authentication change needs a separately approved and reviewed design. |
| D005 | Atomic stock update plus movement; optimistic concurrency for stock and product metadata. | Phase 0 hardening in `997edba` prevents stale changes and inventory-history divergence. Memory and PostgreSQL adapter concurrency/rollback tests passed on corrected implementation `f84f717`. |
| D006 | Committed SQL migrations with database constraints and composite tenant references. | Missing migration history was addressed in `997edba`. Direct SQL constraints and Prisma deployment/repeatability/status/drift passed on corrected implementation `f84f717`. Preserve CHECK constraints Prisma cannot represent. |
| D007 | Verified phases and review gates; no automatic merge or Phase 1 work. | Explicit user requirement. Current Phase 0 includes backend verification only; no React, mockup edits, real payments or unrelated business features. Future phase scope remains undecided. |
| D008 | Version-controlled agent continuity documents and evidence-based status. | Explicit continuity requirement. Update status, pending work, tests/issues, relevant commit/PR and exact next task at each phase or blocked handoff. Never promote code presence to verified completion. |

Decisions above summarize approved direction and committed Phase 0 choices as of
2026-10-30. No production hosting, authentication provider, frontend framework
implementation plan or visual token set has been approved through this log.

Implementation correction (2026-10-30): generator output is schema-relative; use
`../../../apps/api/src/generated/prisma`. This repairs D002 configuration and
does not change the architecture. See the Phase 0 audit for executed evidence.

## Phase 1 design review (2026-10-30)

[Phase 1 design and decision pack](PHASE1_DESIGN.md) records the requested
identity, membership, onboarding, migration and frontend-contract proposals.
Design work is authorized; implementation and provider selection are not.
Phase 0 PR #1 is still open and fetched main remains at `3de3dc1`.
All P01–P10 decisions require approval; this link does not adopt them.
