# Commerce lifecycles — checkpoint

Current commerce: store DRAFT → PUBLISHED; product DRAFT → ACTIVE; stock adjustment
and movement record committed together. Legacy development ownership remains for quarantined demo records; real merchant
operations use account/store membership in a transaction.

Identity: unverified ACTIVE → verified ACTIVE. Only verified ACTIVE identities may
sign in. SUSPENDED/DEACTIVATED rejects sessions; a database trigger revokes sessions
on transition away from ACTIVE, so reactivation never revives old authority.
Deactivation API is disabled pending owner safeguards. No platform suspension API
is exposed without platform authorization.

Session: anonymous → revoked on login; new authenticated session → rotated secrets
→ expiry/revocation. Old secret replay at refresh revokes the whole family.
Password reset/change and logout-all revoke all sessions. One-time challenge is
pending → consumed or expired; resending consumes older pending challenges.

Pending: account/store membership and resumable onboarding, inventory reservation,
customer/cart, authoritative pricing, checkout, COD/simulator/payment reconciliation,
order/refund/cancellation and manual fulfillment state machines. Do not infer that
these are implemented from their inclusion in BACKEND_REQUIREMENTS.md.

## Merchant lifecycle checkpoint

Accounts are ACTIVE/SUSPENDED; migrated unclaimed owners are QUARANTINED. Losing
the sole active owner through identity suspension enters RECOVERY_REQUIRED;
reactivating that identity does not automatically reopen the account. Account
owner mutation serializes on account rows and prevents the last effective owner
from leaving. Store roles are scoped; revocation locks serialize with store writes.

Stores save versioned IN_PROGRESS onboarding → COMPLETED, independently from
DRAFT/PUBLISHED. Explicit publication requires completion and active scope.
Unpublish returns to DRAFT; suspended scopes disappear from public catalog.
Archive is non-destructive and requires DRAFT. Invitations are pending → consumed,
revoked or expired; resend invalidates prior pending tokens. Acceptance requires
verified matching email and a still-authorized active inviter.

Inventory holds: ACTIVE → RELEASED | EXPIRED | COMMITTED; terminal states cannot
be recycled for a new checkout. Same key/input returns the original state even
when terminal; create a new key for a genuinely new operation. Release and expiry
subtract only reserved; commitment subtracts both on-hand and reserved plus an
atomic ORDER_COMMITTED movement per variant. Repeated commitment has no effect.
Store locks serialize creation keys; variant locks use deterministic ordering.
Stock adjustment compares both counters; the database forbids reserved>on-hand.
Reservation history is independent of on-hand movement history. Orders, cancellation
restoration and scheduled cleanup are pending; no paid-order claims at this stage.

Carts: ACTIVE → MERGED | EXPIRED | CHECKED_OUT. Checkout transition is reserved for
the upcoming checkout slice. A guest cart's capability never grants customer/order
access. Merge serializes source/destination, combines quantities once and keeps the
source as terminal history. Owned carts have at most one ACTIVE row per store and
customer. Guest expiry is seven days from creation (matching capability cookie);
owned cart expiry is seven idle days. Refresh and mutations use optimistic versions.
No cart operation reserves or deducts stock. Current quotes warn about changed prices,
inactive catalog and insufficient availability; final checkout pricing is pending.

Checkout checkpoint: DRAFT → READY → DRAFT (edit/requote) | CANCELLED | EXPIRED.
COMPLETED is reserved for the next order-placement use case. Start is idempotent per
store/customer/key and binds the source cart/version. Source-cart FK includes the
customer ID; one DRAFT/READY checkout per cart. DRAFT expiry24h; a READY quote holds
inventory for the bounded reservation lifetime. Input changes release the hold and
clear snapshots in the same transaction; quote failure rolls back release/replacement.
GET processes due expiry; background scheduling remains pending. READY does not
commit inventory and cannot by itself create paid/order state. Checkout actions are
audited without contact/address/token data in operational logs.

COD placement: READY checkout + ACTIVE owned cart + valid hold → COMPLETED checkout,
CHECKED_OUT cart and one PLACED order with payment DUE and fulfillment UNFULFILLED.
Order/items/totals and notification intent commit with stock movement; any failure
rolls everything back. Retries use durable placement keys and source uniqueness.
Final placement refuses catalog/cart/policy/currency changes and expired/closed holds.
Order numbers are per-store transaction counters. Original prices and contact/delivery
snapshots remain immutable even when the catalog changes. Exact largest-remainder tax
allocation conserves every minor unit across item/shipping components. COD payment
collection, fulfillment and cancellation are not implemented at this checkpoint.

Manual COD fulfillment: UNFULFILLED → READY → DISPATCHED → DELIVERED; payment stays
DUE throughout. A separate exact cash collection after delivery sets PAID and order
COMPLETED. Unpaid/undispatched orders may cancel → CANCELLED/VOID, restoring purchased
stock once with ORDER_CANCELLED movements. No return/refund is inferred from delivery.
Command keys bind canonical action/version/input; retries replay without extra effects.
Stock restoration, command/event history, order state and notifications share a
transaction. Internal notes append immutable private history on any order state.
Customer event visibility is an explicit allowlist and excludes all private notes.

Coupon quota: cart application is provisional, with no stock or quota reservation.
Checkout creates a bounded HELD lease alongside stock. It becomes CONSUMED atomically
with a redemption/order, or RELEASED/EXPIRED when checkout closes. Terminal leases do
not reopen. Consumed usage is restored only by a separate cancellation-release record
when the immutable purchase policy permits it. Both global and per-customer capacity
include live leases, preventing asynchronous-payment races. Coupon validity and lease
expiry are rechecked after locks. No discount silently disappears from a placed order.
For zero total, payment is NOT_REQUIRED and fulfillment delivery completes the order;
no paid/captured assertion or payment-confirmation notification is created.

Development payment: INITIATING → PENDING/UNKNOWN → CAPTURED → SUCCEEDED. Definitive
failure releases checkout stock/quota and closes that checkout. A failed provider
payment can later report capture, but the closed/expired checkout causes review instead
of a paid order. CAPTURED observations persist independently of failed order inserts;
reconciliation uses the same placement key and transaction to avoid duplicate orders,
stock movements, redemptions or confirmation intents. Late/invalid money remains
REVIEW_REQUIRED for a later supported resolution/refund workflow. Simulated CAPTURED
state is absorbing even if an older FAILED event arrives. Paid order delivery completes
the order without any COD cash operation. Refunds never imply physical stock returns.

Collected COD refunds: PAID → PARTIALLY_REFUNDED → REFUNDED, with gross paid preserved
and an immutable exact ledger. Merchant explicitly records cash already returned.
The delivered/completed order remains delivered/completed. No refund action changes
on-hand/reserved stock or creates a return movement. Each successful record adds one
safe customer timeline event and one independent notification intent; rollback adds
neither. Provider refund initiation/status and late-capture recovery are separate.
