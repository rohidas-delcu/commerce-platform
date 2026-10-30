# Agent handoff — Commerce Platform

## Read first

1. `docs/IMPLEMENTATION_STATUS.md` — evidence, blockers and exact next task.
2. `docs/PRODUCT_REQUIREMENTS.md` — approved scope and exclusions.
3. `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` — boundaries and rationale.
4. `docs/IMPLEMENTATION_PLAN.md` — phase gates.
5. `docs/DESIGN_SYSTEM.md` — design-reference availability and restrictions.
6. `docs/setup-and-deployment.md` — commands, environment and migration procedures.

## Working rules

- Repository: `rohidas-delcu/commerce-platform`; approved source branch:
  `feature/commerce-backend-end-to-end` from latest main; PR target: `main`.
- Current authorization is the backend journey in `docs/BACKEND_REQUIREMENTS.md`.
  Continue verified vertical slices autonomously; no milestone-by-milestone approval
  is required. First-party credentials are explicitly authorized. Never merge or
  deploy automatically, build UI, or enable unverified live payments.
- Keep one authoritative commerce backend. Preserve domain/application/adapter
  boundaries; avoid duplicated business rules and unnecessary microservices.
- Demo headers are impersonation, not authentication. Keep them explicitly opted
  into development; retain production startup refusal until a later reviewed
  authentication design authorizes a change.
- Preserve money as integer minor-unit strings; enforce store ownership and
  store-scoped uniqueness. Stock writes and movement history must be atomic.
- Use Node.js 24, pnpm 11.25.0 and the committed lockfile. Keep TLS, checksum and
  signature verification enabled. Never commit secrets or log sensitive data.
- In isolated cloud tasks use the existing checkout; do not create a worktree
  unless explicitly requested. Preserve local changes, env files and user data.
- Recheck current runtime/network/Git state; saved settings and past test results
  do not prove a new environment works. Never reset a database to bypass failures.

## Verification and phase handoff

Use the commands in the operations guide. Keep unit, direct SQL, HTTP integration,
Prisma adapter, typecheck, build and remote CI outcomes distinct. A test that was
added, skipped, blocked before execution or passed on older code is not current
verification. Do not substitute mocks for required PostgreSQL checks.

After each phase, and whenever pausing with partial work:

- Update `IMPLEMENTATION_STATUS.md`: completed/verified work, implemented but
  unverified work, pending functionality, actual commands/results, unresolved
  issues, relevant commit/PR and the exact next task.
- Update the plan when scope changes and `DECISIONS.md`/`ARCHITECTURE.md` when
  architectural decisions change. Keep requirements and design documentation
  aligned with explicit approvals; label undecided items instead of inventing them.
- Commit documentation with the work. Do not mark a phase complete until its
  required checks actually pass and its review gate is satisfied.

User instructions govern scope; these files preserve decisions, not permission to
expand them. This handoff must remain usable without prior chat history.

Read `docs/BACKEND_REQUIREMENTS.md` for the current full mission and remaining
acceptance gates; `PHASE1_DESIGN.md` is historical proposal context, not a scope blocker.
