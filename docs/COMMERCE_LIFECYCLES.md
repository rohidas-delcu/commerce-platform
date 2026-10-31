# Commerce lifecycles

## Identity and authority

Unverified ACTIVE → verified ACTIVE. Only active verified identities sign in.
SUSPENDED/DEACTIVATED revoke sessions; reactivation does not revive old secrets.
Deactivation is implemented with last-effective-owner safeguards. Operator suspension
has no public platform-admin endpoint. Merchant and store-customer namespaces are
independent even for the same email. Customer identities cannot acquire memberships.

Anonymous session → revoked on login; authenticated session → rotation, expiry or
revocation. Old-secret refresh replay revokes its family. Password change/reset and
logout-all revoke every session. Challenges expire/consume once; resend invalidates
older pending tokens. Origin/CSRF checks protect cookie-authenticated mutations.

Accounts ACTIVE/SUSPENDED; unmapped legacy ownership QUARANTINED. Loss of the last
active owner through suspension enters RECOVERY_REQUIRED; reactivation does not
silently reopen the account. Account/store locks serialize revocation with writes.
Invitations expire/consume/revoke; acceptance needs matching verified email and an
inviter who is still an authorized owner. Legal cross-account transfer is disabled.

## Stores, catalog and media

Versioned IN_PROGRESS onboarding → COMPLETED independently of DRAFT/PUBLISHED.
Publication requires ready contact/brand/shipping/tax/payment configuration and active
scope. Unpublish → DRAFT. Suspension hides commerce; archive requires unpublished
state and retains records. Product DRAFT → ACTIVE → DRAFT/ARCHIVED; archive does not
implicitly reactivate. Public catalog selects only active, tenant-safe fields.

Media PENDING → COMPLETE or DELETED. Completion validates exact checksum/type/size
and decodes actual raster content. Only complete same-store assets may be linked;
referenced assets cannot be deleted. Public reads require current published use.
Expired pending/tombstoned cleanup uses grace periods, fenced leases and retry; it
never purges complete library assets or financial/security history. Provider delete
acceptance is distinct from permanent erasure of versions/backups.

## Inventory, carts and checkout

Available = on-hand − reserved; constraints forbid negative counters or reserved
above on-hand. Holds ACTIVE → RELEASED/EXPIRED/COMMITTED; terminal keys replay the
same result. Release/expiry only decrement reserved. Commitment decrements both
counters plus one ORDER_COMMITTED movement. Sorted variant locks, DB-clock expiry
checks and atomic history protect races/rollback. Cancellation restoration is separate.

Cart ACTIVE → MERGED/EXPIRED/CHECKED_OUT. Guest capability never grants customer
identity. Login merge serializes both carts and marks source terminal; at most one
active owned cart per store/customer. Guest lifetime7days; owned idle lifetime7days.
Versioned edits use server catalog prices and never reserve stock.

Checkout DRAFT → READY → COMPLETED, with edits returning READY to DRAFT; either
open state can CANCEL/EXPIRE. Start keys bind source cart/version; one active checkout
per cart. DRAFT24h, READY bounded stock/quota hold. Configuration releases holds and
clears snapshots atomically. Billing follows shipping by default or preserves a
separate validated customer choice; reset is explicit. Payment in flight/review
blocks edits/replacement. Trusted maintenance and request paths share release rules.

Placement revalidates cart, catalog, policy, coupon, currency and live hold, then
commits order/items/stock/quota/checkout/cart/outbox atomically. One checkout yields
one logical order and per-store number. Prices/tax/contact/shipping/billing snapshots
remain immutable. Largest-remainder allocation conserves each minor unit. Historical
billing remains null with LEGACY_NOT_COLLECTED, never invented from shipping.

Coupon application is provisional; READY holds quota alongside stock. HELD becomes
CONSUMED with redemption/order, or RELEASED/EXPIRED on closure. Global/per-customer
limits include live holds. Cancellation only restores quota if the purchase policy
explicitly allowed it. Zero totals use NOT_REQUIRED (paid0/due0), not captured money.

## Payments, orders and fulfillment

COD orders start PLACED/DUE/UNFULFILLED. Manual fulfillment UNFULFILLED → READY →
DISPATCHED → DELIVERED. Exact cash collection is separate after delivery and sets
PAID/COMPLETED. Zero-total delivery completes without payment. Commands use versions,
stable keys/digests and immutable events. Private notes never enter customer history.

Development payment INITIATING → PENDING/UNKNOWN → CAPTURED → SUCCEEDED.
Definite failure closes checkout/releases holds. CAPTURED receipt commits before
order finalization; retry after insertion failure reuses that proof and placement.
Late/expired/mismatched capture → REVIEW_REQUIRED, no phantom order or oversell.
Out-of-order failed events cannot undo verified capture. Paid delivery completes
without COD collection. Simulation refuses production; gateway runtime remains disabled.

Unpaid/undispatched cancellation → CANCELLED/VOID, restoring stock exactly once.
An undispatched fully repaid order may explicitly cancel and restore stock; refund
alone never implies a physical return. Already-dispatched delivery remains recordable.

Manual COD refund is an explicit CASH_RETURNED record, not a bank handover guarantee.
Provider refund CREATED → PENDING/UNKNOWN → CONFIRMED → SUCCEEDED or failure/review.
Unresolved intents hold budget. Provider receipt commits before financial finalization;
a failed ledger transaction keeps proof for retry. Gross paid stays immutable;
cumulative refunds yield PARTIALLY_REFUNDED/REFUNDED. Full no-order capture repayment
unlocks the cart without inventing an order/restock. Pending/full refunds block new
dispatch; eligible explicit cancellation handles physical stock separately.

Current owner/admin sessions in active accounts retain existing financial reads,
refunds, notes, cancellation, prior dispatch delivery and COD collection after store
closure. New fulfillment/catalog remain blocked; account suspension denies finance.
Existing customers retain own account/receipts after closure, never renewed shopping.

## Delivery and maintenance

Transactional notification intents survive provider failures. Bounded SKIP LOCKED
leases select identity/order/payment sources; every attempt is recorded. Development
files deduplicate stable identity; SES uncertain outcomes become UNKNOWN instead of
blind resend. Accepted is not inbox-delivered. Stale challenges/payment notices are
suppressed. Optional monolith worker runs expiry → payments → refunds → mail → cleanup
without overlapping batches, and awaits active work before shutdown. Trusted one-shot
CLI uses the same services. No extra service, public mail preview or implicit purge.
