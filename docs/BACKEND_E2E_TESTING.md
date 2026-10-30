# End-to-end testing

`pnpm test`: domain, application and security unit tests.
`pnpm typecheck`, `pnpm build`: workspace compilation.
`pnpm test:integration`: legacy memory HTTP and lifecycle coverage.
`DATABASE_URL=<disposable> pnpm test:postgres`: legacy PostgreSQL suites plus the
new real HTTP identity lifecycle. Identity fixtures provision a deterministic
non-production encryption key inside the harness; no production secrets needed.

Identity test covers signup, unverified denial, one-time verification, CSRF,
profile projection, password hashing, session rotation/replay, logout-all, device
revocation, status suspension/reactivation, recovery/change, logs and throttling.
It decrypts mail in-process as a trusted local test delivery adapter; this is not
SES delivery. PostgreSQL counters are shared across instances; the harness cleans
only its loopback rate-counter fixtures. Each test run needs a disposable database.

Required later: full merchant onboarding/catalog/media journey, customer/cart,
COD, payment simulator success/failure/timeout/late/out-of-order callbacks,
reservations/last-unit concurrency, order/fulfillment and notification retries,
provider sandbox checks, populated migration/rollback rehearsal and complete demo.
Never report these as passed until implemented and executed. Browser cookie/CSRF
acceptance beyond the HTTP harness also remains a production release gate.

`pnpm test:migrations` (NODE_ENV=test, disposable server with CREATE DATABASE)
rehearses a populated Phase 0 upgrade, repeatability/drift and unclaimed owner
quarantine. It removes only the fixture DB created by that process. CI runs it.

MerchantAccess HTTP suite tests sessions → account/store/onboarding → catalog/
inventory → publication, invitation and role lifecycle, cross-tenant access,
last-owner races, and a blocked write observing revocation after an account lock.
PostgreSQL test files run sequentially to isolate loopback rate-counter fixtures.
