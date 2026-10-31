# Phase 4 — Real-browser acceptance

## Scope and approach

The merchant/admin and consumer/storefront UIs are tested in Chromium with the
real NestJS API, PostgreSQL 17, the genuine notification worker, HttpOnly session
cookies, CSRF and origin checks. The suite does not mock fetch, auth, prices,
inventory, fulfillment or payment handlers.

The Playwright global setup runs the existing `demo-backend.mjs` in its explicit
browser mode. That script provisions a unique database on loopback PostgreSQL,
applies committed migrations twice, seeds a published demo store with verified
real image assets, completes a simulated order, and writes private 0600 test
credentials plus development mail into a unique temporary directory. The
browser setup then launches both Vite apps, proxying `/v1` to that loopback API.
After tests, shutdown stops both Vite processes and the demo, which drops only
its own database and removes only its private temporary directory on success.
No production identity/payment/provider credentials are used.

## Browser acceptance scenarios

1. **Merchant onboarding:** new merchant signs up through the real React form,
   receives worker-delivered local verification mail, enters the one-time token,
   logs in, creates an account and a draft store, visits settings and signs out.
2. **Purchase and fulfillment:** anonymous customer browses the published
   catalog, opens a product, adds it to the guest cart, is blocked from checkout
   until signed in, creates and verifies a customer account, logs in and retains
   the guest bag, supplies a delivery address, obtains the server-reserved
   checkout quote and places a COD order. Another anonymous customer and an
   unrelated verified customer are denied access to this order. The merchant
   signs in through the other React app, finds the order, marks it ready,
   dispatches, delivers and confirms receipt of COD. The buyer's receipt reflects
   delivery and payment.

Real money is never charged. The seed demo separately verifies the simulated
payment path, retry and inventory/notification invariants through real HTTP.

## Local execution

Use Node 24, pnpm 11.25.0, a loopback PostgreSQL 17 server with CREATE DATABASE
rights and a development-only database URL. With the development credentials
documented in `docs/LOCAL_DEVELOPMENT.md`:

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm typecheck:browser
pnpm test:browser
```

Postgres must already be running, or the demo can start its documented local
Docker container. Never point this command at a remote or production database.
The browser suite refuses non-loopback PostgreSQL and production mode. The
fixed development ports 5173 and 5174 must be free. Use `--list` to list tests
without starting the API, database, or browser.

## CI and evidence policy

GitHub Actions runs the browser suite after schema verification, unit tests,
TypeScript builds, PostgreSQL integration and the standalone backend demo. CI
installs Chromium with its Linux dependencies. Test screenshots, video and
failure traces remain **unpublished ephemeral job files**; they are ignored by
git and are never uploaded as CI artifacts because they may contain test login
data or verification tokens. Failing tests show their assertion and source
location in the Actions log without the credential file contents.

### Verified acceptance — 2026-10-31

- Local `pnpm typecheck:browser`, `pnpm test:browser --list`, admin TypeScript
  checks and demo-script syntax validation passed.
- Initial PR workflow #69 exposed a real merchant signup routing bug:
  `GET /v1/auth/me` returned 401 for a new visitor and redirected a public
  `/signup` URL to `/login`. The separate customer purchase/fulfillment test
  nevertheless passed on that run. The merchant app now preserves public
  login/signup/verification/recovery routes on initial unauthorized checks.
- [GitHub Actions workflow #70](https://github.com/rohidas-delcu/commerce-platform/actions/runs/41216122912),
  commit `b845ae2181b2340ad74996c0ab6a1eeb03557cd1`: **SUCCESS** for
  all backend/PostgreSQL/demo, admin/storefront, browser TypeScript, and real
  browser steps. Playwright reported **2 passed (20.7 s)**, no failed or
  skipped tests. The actual UI was exercised; this is more than discovery.
- [Draft PR #5](https://github.com/rohidas-delcu/commerce-platform/pull/5)
  remains unmerged, pending human review. These results are not production
  readiness or broad cross-browser acceptance.

## Boundaries still requiring review

- Local sample COD and simulator only; no Razorpay/S3/SES owned-account sandbox
  acceptance or live payment capture, refund or delivery claim.
- Chromium desktop only; cross-browser/mobile/assistive technology, visual QA,
  production deployment and recovery/observability remain separate release gates.
- Tax/legal, privacy/retention, webhook/ingress and payment-provider activation
  remain unapproved. Production startup stays disabled.
- No branch is auto-merged or deployed by this phase.
