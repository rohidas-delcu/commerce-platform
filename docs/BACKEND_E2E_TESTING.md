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

Customer HTTP coverage now executes same-email independent merchant/two-store signup,
one-time and cross-store challenge checks, unverified login, cookie renaming attacks,
CSRF, actual Argon2 login, scoped addresses and concurrent default selection, SQL
scope/FK guards, safe wishlist/archive filtering, session replay revocation, password
recovery, suspension/logout and brute-force throttling. These are customer account
journeys; purchase/order flows B–I remain pending. Migration rehearsal additionally
preserves issued merchant credential/session values across namespace migration.

Cart coverage is part of the real customer PostgreSQL HTTP journey: guest creation,
CSRF/capability scope, owned cart, variant/tenant boundaries, ignored-price prevention
through DTO rejection, current exact subtotals, no stock reservation, login merge and
retry, concurrent stale edits, price refresh, stock/catalog changes, clearing and
expired replacement. Purchase/payment/fulfillment flows still remain pending.

Pricing coverage executes optimistic concurrent merchant policy writes, prerequisite
checks, missing-policy failure, real cart estimates with exact tax arithmetic,
unsupported destination rejection and amount-tampering rejection. Unit vectors cover
exclusive/inclusive tax, half-up rounding, discounted free-shipping thresholds and
coupon eligibility arithmetic. Coupon persistence/usage, checkout and orders are not
implemented; these vectors do not verify those future lifecycles.

Checkout HTTP/PostgreSQL coverage creates two real verified customers and owned carts
for the last available unit, starts/configures durable checkouts and competes for a
reservation. Exactly one succeeds. Retry does not duplicate allocation; input changes,
cancel/retry and expiry release correctly, with on-hand unchanged and no sale movement.
Tests cover start-key mismatch, active-checkout uniqueness, stale versions, private SKU
exclusion, cross-customer reads and a direct SQL source-cart/customer FK violation.
These checks still do not place an order or verify a payment.

COD HTTP/PostgreSQL coverage now places one real order through concurrent retries,
checks exact DUE/paid0 amounts, order/counter/outbox uniqueness and one stock deduction.
A controlled BEFORE INSERT order failure proves stock, reservation, checkout, cart,
counter and notification rollback before successful retry. Price/policy changes require
re-quote. Order history remains unchanged after catalog price edits. Customer/merchant
projections, editor permission denial, SQL tenant/item references and immutable financial/
event history are tested. No real cash collection, email delivery, gateway or fulfillment
is implied by these placement checks.

The COD PostgreSQL journey now also executes owner/admin ready/dispatch/delivery,
separate collection, duplicate commands and private-note visibility. A second order
is cancelled with a controlled restoration-insert failure, proving rollback, followed
by concurrent retry proving exactly one stock restoration and cancellation notice.
Invalid backward transitions, premature/wrong-amount collection, late cancellation
and editor writes are rejected. Customer COMPLETED/CANCELLED filters and safe carrier
history are verified. This does not verify refunds, online payments or email delivery.
