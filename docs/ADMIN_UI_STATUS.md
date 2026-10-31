# Merchant admin UI — implementation checkpoint (2026-10-31)

Branch `feature/commerce-admin-ui`, stacked on backend draft PR #2 (`feature/commerce-backend-end-to-end`, initial head `f4e919869320ed461e2ac6d6045266f04969825b`). **Do not merge this branch into `main` until backend PR #2 is reviewed/merged and the frontend is rebased/retargeted.** Backend production runtime remains disabled.

## Delivered in `apps/admin`

- Vite + React + TypeScript app in the pnpm workspace, separate production artifact and dev proxy.
- Merchant email/password signup, verification-token confirmation, resend, login, forgot/reset, logout; no fake passwords or demo identity headers.
- Credentialed requests, CSRF bootstrap and token rotation on login, in-memory CSRF (not localStorage), account and store-scoped selection, explicit error UI.
- Expired protected sessions clear in-memory identity/query state and return to the login screen.
- Merchant store switches reset all store-specific editable form state, dialogs and drafts; no form reuses pricing policy state from a different tenant.
- Account creation, store onboarding, multi-store switching and store creation; invite token acceptance for colleagues joining an existing organization.
- Store creation reuses an idempotency key for exact retries and retains the newly created merchant account if creating its first store fails.
- Dashboard with explicitly **sampled** paid-order and catalog aggregates (backend has bounded pagination, not authoritative analytics totals).
- Products: search/filter/page, create/edit, activate/deactivate/archive, add variants, update inventory, reserve/upload/complete verified product images.
- Collections: create/edit/archive and product assignments, versioned writes.
- Inventory: view products/variants and movement ledger; stock count updates from product detail.
- Orders: paged list/details, READY→DISPATCH→DELIVER, separate exact COD collection, eligible cancel, private notes, manual COD and development-simulator refunds. Uses stable command keys per action+version while retrying.
- Coupons: create and archive with exact fixed amounts or basis-point percentages.
- Pricing: shipping methods and per-country tax rates, COD and development simulator policy, versioned save.
- Store settings: contact/brand/timezone, verified logo uploads, complete onboarding, publish/unpublish.
- Team members, role labels, store-scoped invitations/revocation; account owner permissions remain backend-enforced.
- Payment attempts list; account profile/password change and session revocation.

## Verification (this checkpoint)

- `pnpm install`: completed; workspace lockfile updated.
- `pnpm typecheck:admin`: passed after contract fixes.
- `pnpm test:admin`: 3/3 unit tests passed (BigInt exact money, CSRF/token rotation/cookie credentials, protected 401/session invalidation).
- `pnpm build:admin`: passed Vite production build.
- `git diff --check`: passed for tracked diffs.
- `.github/workflows/ci.yml`: extended the existing PostgreSQL-backed backend workflow to also check admin types, unit tests and production bundle on pull requests.
- **Not executed**: real browser E2E against a PostgreSQL backend; this execution environment has no Docker executable, and no owned PostgreSQL test instance or test mailbox was connected. UI journeys need actual end-to-end verification before ready-for-review release claim.

## Cautions / open work

1. Review all admin screens visually against the approved Commerce Studio HTML prototype. That prototype exists separately from Git; this implementation uses its typography, spacing, palette, and general layout as a design reference, not a certified pixel-identical migration.
2. Run Playwright with a real browser/PostgreSQL/worker and actual API: account+verification→store→pricing→product+image→publish→consumer purchase→admin fulfillment/refund. Test role denies, tenant switching, stale-version 409, expired sessions, CSRF, upload CORS and network failures. A successful TypeScript build does **not** prove these flows work at runtime.
3. The backend does not expose a merchant-wide customer directory or authoritative aggregate analytics API. The admin UI must not fake these features or leak customer PII through shopper endpoints.
4. No owned SES/S3 production acceptance, provider settlement, real gateway sandbox, production TLS/CORS/CSRF configuration or restore drills have been performed.
5. Browser file inputs have no advanced crop/reorder gallery, collection product selection is bounded at 100, and larger product/admin datasets require backend pagination UX enhancements. Improve before declaring Admin v1 complete.
6. Native consumer storefront and Delcu AI/headless component SDK have **not** started. Implement those after backend PR review and admin browser acceptance.

## Handoff / next development task

1. Confirm PR #2 latest head CI success and independently review auth/session/financial boundaries; merge only after user review.
2. Run admin UI with isolated real backend: `pnpm demo:backend` (see `docs/LOCAL_DEVELOPMENT.md`) and `pnpm dev:admin`; verify browser user journeys with Playwright, fix all mismatches and visual issues; add CI UI tests.
3. After admin acceptance, create `apps/storefront` (Vite React) from the approved consumer HTML reference, using only public and customer-scoped API endpoints. The storefront must support guest/cart, store-scoped customer auth, checkout, COD/simulator, order history and responsive themes without any merchant privileges.
4. Maintain this file with exact test evidence and PR/commit SHA. Never claim production-ready checkout while payments are simulated and backend production mode remains disabled.
