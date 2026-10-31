# Consumer storefront — implementation checkpoint (2026-10-31)

Branch `feature/commerce-storefront-ui`, stacked on merchant UI branch
`feature/commerce-admin-ui` (draft PR #3), itself stacked on backend PR #2.
Neither backend nor frontend has been merged or deployed. Production backend
startup remains disabled.

## Implemented in `apps/storefront`

- Vite, React, TypeScript and TanStack Query app, independent build and dev proxy.
- Responsive merchant-branded storefront with public catalog/search/collections,
  product variants, stock visibility and server-backed shopping bag.
- Store-scoped customer signup, verification/resend, login, recovery/reset,
  profile and password change; cookie/CSRF bootstrap and in-memory CSRF tokens.
  No merchant API or demo authentication headers in customer requests.
- Guest cart changes, coupon, price acknowledgement and one-time merge on login.
  Customer checkout requires a verified, authenticated identity.
- Narrow public checkout-options endpoint to discover active shipping choices
  and COD/development-simulator flags, without exposing private tax policy.
- Server quote, idempotent checkout creation, versioned configuration, stock
  reservation, explicit final review, cancellation and COD order placement.
- Development-only simulation/reconciliation with no browser-side paid claim.
  Customer-owned order history, fulfillment timeline and refund history.
- Default visual theme uses published merchant name and logo. A configurable
  theme editor and Delcu AI Web Components/SDK are later, separate work.

## Verification and limits

- `pnpm typecheck:storefront`: passed.
- `pnpm test:storefront`: 4 tests passed (BigInt money, per-store CSRF,
  protected error behavior, token rotation).
- `pnpm build:storefront`: passed production Vite build.
- Focused `public-checkout-options.test.mjs`: 1 test passed.
- Backend 65 domain/unit tests passed after Prisma client regeneration;
  `pnpm typecheck`, `pnpm build` and 4 memory integration tests passed.
- Merchant admin's existing 3 unit tests passed.
- Prisma generation required a placeholder development `DATABASE_URL` only for
  code generation; no database was connected or changed.
- Real PostgreSQL tests are deferred to the GitHub CI service and later owned
  browser acceptance; Docker/loopback PostgreSQL was not present locally.
- **Not verified:** real browser E2E against PostgreSQL, SES/S3, gateway,
  production TLS/CORS/CSRF, and real bank/provider sandbox. Live payment
  activation and production startup guards remain unchanged. COD starts DUE.

## Browser acceptance gate

1. Disposable PostgreSQL: merchant signup/verify/login, store/pricing/COD setup,
   product/variant/stock/image and publish; open the public storefront.
2. Customer signup/verify/login, guest cart and merge, coupon, quote, reserve,
   expiry/retry/cancel, COD placement exactly once, owned order history.
3. Merchant ready→dispatch→deliver→COD collection and eligible refund; verify
   safe customer timeline and totals without internal notes.
4. Two stores: tenant isolation, cookie/CSRF, stale-version 409, expired
   identity/session, payment simulation and duplicate idempotency keys.
5. Unpublished/closed store: existing account/receipts remain available where
   permitted, but catalog/new cart/new checkout remain unavailable.

## Next

Complete tests and PR/CI evidence; then Playwright with disposable PostgreSQL.
Do not auto-merge/deploy or enable live providers before owned acceptance.
