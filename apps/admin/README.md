# Commerce Studio merchant admin

Vite/React merchant workspace built against the session-authenticated PostgreSQL API on `feature/commerce-backend-end-to-end`. The design adapts the approved separate Commerce Studio HTML prototype; it does not embed the prototype's localStorage/demo authentication, simulated business data or fake purchases.

## Local start

From repo root, use Node 24 / pnpm 11.25.0:

1. Start backend with its configured PostgreSQL, allowed browser origin `http://127.0.0.1:5173`, and private email outbox. See `docs/LOCAL_DEVELOPMENT.md`.
2. `pnpm install --frozen-lockfile`
3. `pnpm dev:admin`, then visit `http://127.0.0.1:5173` (the API's `CORS_ORIGINS` must contain this exact origin).

The Vite dev server proxies `/v1` and `/health` to `http://127.0.0.1:3000` by default. Set `ADMIN_API_TARGET` only to a trusted local development backend. All merchant mutations carry session cookies and the server-issued CSRF token. The API must be running in PostgreSQL mode; memory/demo impersonation does not support this UI.

## Supported screens

Merchant signup, email verification, login/reset/logout, account/store creation, store switching, dashboard sample metrics, products and images, variants and stock counts, collections, inventory, order detail/manual fulfillment/COD collection/refunds, coupons, shipping/tax/payment settings, publishing, team invitations, sessions/profile and payment-status lists.

## Review notes

- The backend currently rejects production runtime; no storefront checkout frontend or live payment capture is enabled.
- The actual customer-facing checkout UI is the next workstream; do not label the API JSON catalog as a shopping site.
- Dashboard aggregations are deliberately labeled sampled; the backend has bounded paged lists, not global reporting endpoints.
- Business-state transitions, permissions and financial values come from the API. No financial action is inferred from client status.
- Browser E2E acceptance, image upload/S3 CORS, SES delivery and production deployment are pending external gates.

Detailed verification and continuation guide: `docs/ADMIN_UI_STATUS.md`.
