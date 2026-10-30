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
