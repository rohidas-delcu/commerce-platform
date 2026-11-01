# Commerce frontend code-quality baseline

The merchant admin and customer storefront are TypeScript React applications, not checked-in production bundles. This cleanup replaces condensed, oversized source modules with focused feature files and introduces enforced formatting, linting and TanStack Router.

## Where code lives

- Merchant admin: `apps/admin/src/auth/Authentication.tsx` (identity screens), `setup/Setup.tsx` (onboarding), `layout/Workspace.tsx` (navigation), `providers/StoreContext.tsx` (active store), `components/Ui.tsx` (shared widgets), `pages/catalog`, `pages/commerce` and `pages/management` (one module per feature page).
- Storefront: `apps/storefront/src/pages/DiscoverStore.tsx`, `StorefrontLayout.tsx` (store-specific shell), `providers/ShopContext.tsx`, `components/Feedback.tsx`, and feature page subdirectories `pages/account`, `pages/catalog` and `pages/checkout`.
- Both apps: `src/router.tsx` defines TanStack Router route trees and `src/main.tsx` provides their `RouterProvider`. Existing public URLs are preserved. React Router is no longer a dependency.
- Compatibility barrel files under `pages/` preserve page exports without reintroducing business logic.

## Local commands

From the repository root on Node 24 with pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm format         # apply Prettier to admin and storefront source
pnpm format:check   # required in CI
pnpm lint           # required in CI (TypeScript and React Hooks)
pnpm typecheck:admin
pnpm typecheck:storefront
pnpm test:admin
pnpm test:storefront
pnpm build:admin
pnpm build:storefront
```

The full GitHub Actions pipeline additionally runs backend/domain/PostgreSQL/migration checks and real Chromium Playwright purchase journeys. **A successful source check or production compilation alone does not establish browser acceptance.** The refactor remains reviewable and unmerged until the new CI run passes and reviewers approve it.

## Conventions for future work

1. Make feature pages and complex components independently discoverable; keep the application entry point and router declarative and small. Do not put multiple unrelated workflows into a giant `App.tsx`.
2. Keep API/monetary helpers in `lib`, authenticated context in `providers`, and view-only widgets in `components`. Avoid pages importing state or widgets via the app root.
3. Use TanStack Router `Link`, `Navigate`, `Outlet` and typed route navigation; preserve query parameters (`next`, collection view, etc.) across redirects. Avoid manually setting `window.location` for in-app navigation.
4. Preserve store/session and customer separation, CSRF, idempotency and all server-side financial/stock invariants; a frontend cleanup does not authorize weakening them.
5. Run `format:check`, `lint`, TypeScript, relevant unit tests and browser E2E after changes to routing or shared UI components.

## Scope and limitations

This is a source-organization and tooling change, not a redesign or new feature. No database schema, backend pricing/checkout policy or production payment activation changes are intended. The current lint rule set targets merchant/storefront code; backend TypeScript remains subject to its existing typecheck/unit/integration pipeline. Further backend linting may be introduced separately after auditing existing rule violations.
