# Implementation plan

Phase0 merged through PR1 at `6b30e822eef709087308d12d8024766f4b4d4ef8`.
The user then authorized the full backend mission in BACKEND_REQUIREMENTS.md,
superseding the earlier design-only Phase1 proposal. Work is on
`feature/commerce-backend-end-to-end`, draft PR2 targeting main.

## Delivered vertical slices (verification in IMPLEMENTATION_STATUS.md)

1. First-party merchant identity, credential/session security, account and store
   memberships, centralized permissions, invitations and owner safeguards.
2. Resumable onboarding, configuration, publication and historical quarantine.
3. Product/variant lifecycle, exact prices/SKUs, search, collection ordering,
   verified media and branding.
4. Transactional stock holds/expiry/commitment, scoped customers, addresses,
   wishlist, guest/customer carts and one-time login merge.
5. Shipping/tax configuration, exact quote/coupon quota, durable checkout,
   billing provenance and immutable COD orders.
6. Manual fulfillment, cancellation/restoration, separate COD collection,
   development payment observations/reconciliation and shared refund ledger.
7. Closed-store financial continuity, durable local/SES notification boundary,
   optional monolith maintenance worker, Razorpay candidate boundary and cleanup.
8. Complete disposable backend demo, CI execution, configuration/pagination audit.

## Final gate

Execute locked install/audit, Prisma validation/generation, migration deployment/
repeat/status/drift, populated preservation, units, typecheck, build, memory HTTP,
real PostgreSQL regression and complete demo. Push; wait for green exact-source
GitHub Actions and update current status/PR. Review identity/security, concurrency,
financial lifecycle and migration/data-preservation behavior before merge.
No automatic merge or deployment.

## External release gates

Owned S3 bucket/IAM/CORS/version/lifecycle acceptance; owned SES sender/sandbox and
bounce/complaint handling; Razorpay merchant ownership/adoption, scoped registry,
non-idempotent creation claims, ingress wiring and actual sandbox/security checks.
Keep providers disabled/unverified where appropriate; do not call fakes live tests.
Production rollout also needs TLS, managed secrets, least-privilege DB role,
backup/restore, monitoring and legal tax/privacy/retention review. Legal ownership
transfer and ownerless-account recovery remain explicitly disabled.

After backend delivery, stop for review. Merchant/admin storefront UI and its
approved HTML reference are separate future authorization, not the next automatic task.
