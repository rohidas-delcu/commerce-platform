# Commerce lifecycles — checkpoint

Current commerce: store DRAFT → PUBLISHED; product DRAFT → ACTIVE; stock adjustment
and movement record committed together. Ownership is still the legacy subject check.

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
