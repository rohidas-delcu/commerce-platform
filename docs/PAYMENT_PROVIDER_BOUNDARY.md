# Razorpay candidate boundary — not activated

The user requested an India-focused candidate boundary while keeping each merchant
responsible for its own payment acceptance/settlement. Razorpay is implemented as a
**test-only adapter candidate**, not an approved production provider or platform
merchant-of-record model. Normal HTTP checkout still accepts COD/development simulation.
No runtime account registry, gateway checkout selection or public webhook ingress is
enabled; no credentials are read implicitly or sent by ordinary application startup.
Production startup and live Razorpay keys remain refused.

## Contracts and implications

`RazorpayTestGateway` takes an explicit trusted server scope: store UUID, Delcu merchant
account UUID, owned test key pair and explicit webhook secret. It must never be built
from unvalidated client JSON. Secrets remain in private fields; JSON output excludes
keys. Transport uses Node fetch/crypto, fixed HTTPS host, TLS verification, a10second
abort, bounded JSON, rejected redirects and no automatic retries. Payment/refund
adapters implement the existing ports; creation is explicitly **not idempotent**.
Receipt UUIDs correlate requests and do not confer a provider idempotency promise.
Unknown POST outcomes require reconciliation, never blind replacement creation.

The boundary conservatively supports INR and integer minor units within JavaScript's
safe integer range, rejecting larger values before any request. It creates orders
with partial_payment=false and does not invent a capture setting or invoke capture
from a browser result. A signed checkout result authenticates references only. Only
a fresh, coherent captured payment plus paid order, exact amount/currency, pinned
order/payment references and matching recorded refund balance can produce capture
proof. An authorized/failed individual attempt does not make a still-payable provider
order terminal. Multiple captures or inconsistent provider state stay uncertain.

Raw webhook HMAC-SHA256 verification uses the exact bounded bytes and a constant-time
comparison; reserializing JSON changes the signature. The returned scope comes from
server configuration, never body notes or an unsigned event header. Evidence IDs hash
the raw bytes; financial observations use stable canonical provider-state identities
and the existing PostgreSQL unique/event ledger for durable effect deduplication.
Signed webhooks still require authoritative provider reads before financial commitment.

Refund creation uses the documented singular `/payments/:id/refund` path; reads use
`/payments/:paymentId/refunds/:refundId`. References/amount/currency are checked, private
merchant free-text is not forwarded, and provider PROCESSED is not a claim of when a
recipient's bank credits funds. Existing generic receipt/financial persistence ports
were tested with explicit deterministic Razorpay fixtures. Unverified gateway order
placement remains blocked; tests do not enable a fake gateway in normal runtime.

## Evidence and source

Official source examined at commit
[b9e8527225a7322ba2671a3bc0b848fd019d2d8c](https://github.com/razorpay/razorpay-node/tree/b9e8527225a7322ba2671a3bc0b848fd019d2d8c):

- `documents/order.md`, `payment.md`, `paymentVerfication.md`, `refund.md`.
- `lib/resources/orders.js`, `payments.js`; the singular refund path matches the SDK.

Direct provider documentation returned HTTP403 in this environment; official GitHub
SDK documentation/source were available. Unit tests inject deterministic HTTP responses;
PostgreSQL/HTTP fixture tests validate signed evidence, authoritative read conversion,
immutable/deduplicated capture/refund records, exact balances and disabled HTTP gateway
selection. No test contacted a real Razorpay account or executed a provider sandbox.

## Remaining adoption/activation gates

- Confirm provider adoption/account ownership and settlement responsibilities; do
  not assume platform aggregation, payouts or legal merchant-of-record status.
- Supply owned test account configuration and a reviewed encrypted credential registry
  with store/account binding, rotation and audit. Current constructor scope is a port
  boundary; it does not prove external KYC/account ownership.
- Implement/review account selection and signed HTTP ingress with that registry,
  plus a durable single-creation claim before non-idempotent provider POSTs. No hard
  guard should be removed merely because an adapter contract fake passed.
- Execute real owned sandbox payment/refund/capture policy, webhook delivery/replay,
  timeout/reconciliation and out-of-order cases. Review orders that remain payable
  after a hold expires and manual actions performed outside the platform.
- Complete security/operational acceptance before enabling production or live keys.

These are explicit provider adoption/ownership/acceptance limits, not a claim that
setting an environment variable makes online checkout production-ready. The full
self-contained purchase demonstration uses the clearly labeled development simulator.
