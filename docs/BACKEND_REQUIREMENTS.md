# Authorized end-to-end backend mission (2026-10-30)

User-supplied implementation requirements. This supersedes the earlier design-only
scope; implementation status must still distinguish incomplete work.

```text
ROLE
You are the principal backend engineer responsible for delivering
the complete end-to-end backend of the Delcu Commerce Platform.

Repository:
https://github.com/rohidas-delcu/commerce-platform

Base branch: main

MISSION

Implement a fully working headless commerce backend covering:

Merchant registration and authentication
        ↓
Merchant account and store onboarding
        ↓
Catalog, products, collections and inventory
        ↓
Store publication
        ↓
Customer registration and authentication
        ↓
Product discovery
        ↓
Cart management
        ↓
Checkout, shipping, tax and discounts
        ↓
Payment processing
        ↓
Order placement
        ↓
Order management
        ↓
Fulfillment and delivery
        ↓
Customer order history

This is an IMPLEMENTATION task.

Do not stop after generating architecture documents or a plan.

Work through the implementation autonomously, milestone by milestone.

Do not ask for approval after every milestone.

Only stop for genuine blockers involving permissions, credentials,
external account ownership, potentially destructive migrations,
or decisions that cannot safely be represented by a configurable
interface and an explicit development-mode implementation.

The user has explicitly authorized implementing the backend journey.

Do not implement React, the merchant admin UI, or the storefront UI
in this task.

==================================================
1. READ AND PRESERVE THE EXISTING FOUNDATION
==================================================

Read:

AGENTS.md
docs/PRODUCT_REQUIREMENTS.md
docs/ARCHITECTURE.md
docs/DECISIONS.md
docs/IMPLEMENTATION_PLAN.md
docs/IMPLEMENTATION_STATUS.md
docs/PHASE1_DESIGN.md

Inspect the actual source code, tests, Prisma schema and CI configuration.

Phase 0 has been merged into main.

Some documentation may still describe the earlier unmerged state.
Update those historical status references accurately.

Preserve:

- Existing NestJS modular monolith.
- Domain/application/infrastructure boundaries.
- Prisma and PostgreSQL.
- pnpm monorepo.
- Existing IDs and tenant constraints.
- Exact integer minor-unit money representation.
- Existing inventory consistency guarantees.
- Public catalog privacy.
- Existing working tests.

Do not restart the project from scratch.

Create a feature branch from the latest main:

feature/commerce-backend-end-to-end

Never push directly to main.

==================================================
2. IMPLEMENTATION STRATEGY
==================================================

Implement the backend in sequential vertical slices.

Each slice must:

1. Implement domain rules.
2. Implement application use cases.
3. Implement persistence.
4. Add migrations when required.
5. Expose API endpoints.
6. Add validation and authorization.
7. Add unit and integration tests.
8. Pass typechecking and build.
9. Preserve existing tests.
10. Commit the completed slice.

Do not create only database entities without the corresponding
working use cases and APIs.

Do not generate fake implementations and claim functionality works.

Continue into the next slice automatically when the current slice passes.

If the task is interrupted by a context, time or token limit:

- Commit verified progress.
- Update implementation status.
- Record exact remaining tasks.
- Record failing and blocked tests separately.
- Leave the repository in a recoverable state.

A future Codex session must be able to resume by reading AGENTS.md
and IMPLEMENTATION_STATUS.md without needing chat history.

==================================================
3. MERCHANT IDENTITY AND AUTHENTICATION
==================================================

Implement working merchant authentication.

Required functionality:

- Merchant signup.
- Email verification.
- Resend verification.
- Login.
- Logout.
- Logout from all devices.
- Forgot password.
- Reset password.
- Current user profile.
- Update basic profile.
- Change password.
- View and revoke active sessions.
- Account suspension/deactivation safeguards.

Use a production-oriented first-party credential implementation
for the initial self-contained backend.

Requirements:

- Argon2id password hashing using a maintained library.
- No custom cryptography.
- Proper password policies.
- One-time, expiring verification and recovery challenges.
- Store challenge tokens only as cryptographic digests.
- Generic responses to avoid account enumeration.
- Secure server-side sessions.
- HttpOnly/Secure cookie configuration.
- CSRF protection for cookie-authenticated mutations.
- Session rotation and revocation.
- Rate limiting and brute-force protections.
- Safe operational and security audit logs.
- No passwords, session secrets or tokens in logs.
- No JWTs or session secrets in localStorage.
- No arbitrary identity header accepted as production authority.

Preserve an IdentityAuthorityPort and stable internal identity IDs
to enable future integration with Delcu Identity or another OIDC
provider without rewriting commerce ownership.

Do not build a separate identity microservice.

Existing development demo authentication must never be accepted
as production authentication.

==================================================
4. MERCHANT ACCOUNTS AND STORE OWNERSHIP
==================================================

Implement:

Identity
MerchantAccount
MerchantMembership
Store
StoreMembership
Membership roles and permissions
SecurityAudit

Relationship:

One identity can belong to multiple merchant accounts.
One merchant account can own multiple stores.
Each store belongs to exactly one merchant account.

Initial roles:

ACCOUNT_OWNER
STORE_ADMIN
STORE_EDITOR
STORE_VIEWER

Use a centralized authorization policy.

Do not hardcode permissions independently in controllers.

Account owners have authority over their account's stores.
Other users require explicit scoped access.

Implement:

- Account creation.
- Store creation.
- List accessible stores.
- Store switching API.
- Store membership management.
- Member invitations.
- Accept/revoke invitations.
- Change roles.
- Remove members.
- Prevent removing the last effective owner.
- Prevent privilege escalation.
- Immediate revocation of removed membership authority.

Complex legal ownership transfer between separate merchant accounts
may remain a documented, disabled operation unless explicitly approved.

Enforce tenant isolation at application and persistence boundaries.

Use transactions and concurrency protection for membership mutations.

==================================================
5. STORE ONBOARDING AND SETTINGS
==================================================

Implement end-to-end store onboarding.

Flow:

Merchant signup
    ↓
Merchant account created
    ↓
Create store
    ↓
Store information
    ↓
Country/currency
    ↓
Contact information
    ↓
Shipping settings
    ↓
Payment settings
    ↓
Branding
    ↓
Review
    ↓
Complete onboarding
    ↓
Merchant dashboard APIs

Requirements:

- Draft stores.
- Resumable onboarding.
- Saved progress.
- Idempotent store creation.
- Globally unique store handle.
- Store settings updates.
- Supported country/currency validation.
- Store timezone.
- Contact information.
- Logo/branding metadata.
- Store publication/unpublication.
- Explicit publication prerequisites.
- Optimistic settings versioning.
- Store suspension.
- Store deletion/archival safeguards.

Onboarding completion must not automatically publish a store.

Preserve existing commerce IDs and data.

Use additive database migrations.

Do not silently assign legacy demo-owned stores to a newly
registered merchant.

==================================================
6. PRODUCT CATALOG
==================================================

Implement complete merchant catalog management.

Products:

- Create.
- Edit.
- Archive.
- Activate/deactivate.
- List.
- Search.
- Filter.
- Sort.
- Pagination.
- Product detail.
- Product handle and SEO metadata.
- Description.
- Compare-at price.
- Visibility/publication status.

Variants:

- Multiple variants.
- Variant names/options.
- SKU.
- Variant-specific price where needed.
- Stock.
- Availability.
- Variant activation/deactivation.

Collections:

- Create.
- Edit.
- Archive.
- Collection ordering.
- Add/remove products.
- Featured collections.
- Public collection listing.

Media:

- Multiple product images.
- Image ordering.
- Primary image.
- Upload reservation.
- Presigned object storage uploads.
- Upload completion verification.
- Metadata validation.
- Safe deletion/replacement.
- Development storage adapter.
- S3 production adapter.

Do not accept arbitrary external image URLs as trusted uploaded assets.

Preserve store-scoped uniqueness and tenant isolation.

All public catalog endpoints must expose only explicitly approved fields.

Provide:

- Public products.
- Public product details.
- Public collections.
- Search/filter/sort.
- Availability.
- Pagination.

Never expose merchant ownership information, internal audit fields,
or confidential inventory metadata to public clients.

==================================================
7. INVENTORY
==================================================

Extend the existing inventory foundation.

Required:

- Stock on hand.
- Reserved stock.
- Available stock.
- Inventory adjustments.
- Inventory movement history.
- Inventory reservations.
- Reservation expiry.
- Reservation release.
- Order stock commitment.
- Order cancellation stock handling.
- Concurrency protection.

Rules:

Available = OnHand - Reserved

Cart creation must not permanently reserve inventory.

Checkout initiation may create a bounded reservation.

Never allow available stock to become negative.

Prevent overselling when multiple customers purchase
the last available unit concurrently.

Inventory reservation, release and commitment must be
idempotent and transactionally consistent.

A duplicated callback or retry must never deduct inventory twice.

Test simultaneous checkout attempts and payment/expiry races.

==================================================
8. CUSTOMER AUTHENTICATION
==================================================

Implement customer authentication separately from merchant authorization.

Customer accounts are scoped to the applicable store.

Required:

- Customer signup.
- Email verification.
- Login.
- Logout.
- Forgot/reset password.
- Profile.
- Saved addresses.
- Default address.
- Order history.
- Order details.
- Wishlist/favorites.

Reuse secure authentication infrastructure where sensible,
but do not allow customer sessions to access merchant APIs.

The same email may be a merchant identity and a store customer
without automatically combining their permissions.

Support secure store-scoped customer sessions.

Design the session and cookie contracts so a future storefront
can operate on an independent merchant domain using a
same-origin proxy/BFF where needed.

Do not depend on one shared cookie across unrelated store domains.

==================================================
9. CART MANAGEMENT
==================================================

Implement:

- Create cart.
- Guest cart.
- Authenticated customer cart.
- Add product variant.
- Update quantity.
- Remove item.
- Clear cart.
- Cart expiry.
- Merge guest cart after login.
- Cart price refresh.
- Stock availability validation.
- Coupon application/removal where enabled.

Never trust prices or totals sent by the frontend.

Persist quantity and variant identity, not authoritative client prices.

Calculate totals server-side using current catalog and pricing rules.

Return structured cart validation messages when products
become unavailable, inactive or change price.

Do not leak carts across customers or stores.

==================================================
10. SHIPPING, TAX AND DISCOUNTS
==================================================

Implement a minimal but extensible pricing engine.

Shipping:

- Shipping address.
- Billing address.
- Shipping zone.
- Flat-rate shipping.
- Free shipping thresholds.
- Shipping method selection.
- Shipping quote.
- Store-specific shipping configuration.

Discounts:

- Percentage discount.
- Fixed-amount discount.
- Coupon code.
- Validity period.
- Usage limits.
- Per-customer restrictions where applicable.
- Prevent double application on retries.
- Prevent negative totals.

Tax:

- Typed tax configuration and calculation interface.
- Store-specific tax settings.
- Persist calculation snapshots on orders.
- Validate supported jurisdiction/currency.
- Explicit configuration for tax-inclusive/exclusive prices.
- No hardcoded production GST/tax rates.
- No claim of legal tax compliance without appropriate review.

All calculations must use exact integer minor units.

Never use floating-point arithmetic for monetary totals.

Recalculate final amounts at checkout.

Return an itemized quote:

Subtotal
Discount
Shipping
Tax
Total
Currency

==================================================
11. CHECKOUT
==================================================

Implement a complete checkout state machine.

Required operations:

- Start checkout.
- Set customer/contact.
- Set shipping address.
- Select shipping method.
- Apply discounts.
- Calculate authoritative quote.
- Validate store/product availability.
- Reserve inventory.
- Choose payment method.
- Place order.
- Resume checkout.
- Expire abandoned checkout.

Use durable checkout identity and idempotency keys.

Prevent duplicate orders from repeated submit clicks.

Do not trust client-supplied item totals.

Snapshot:

- Product name.
- Variant name.
- SKU for internal order records.
- Quantity.
- Unit price.
- Discount.
- Tax.
- Shipping.
- Currency.
- Customer details.
- Delivery address.

Persist final order totals independently of later
product price or catalog changes.

Implement optimistic/concurrency protection for checkout state.

==================================================
12. PAYMENTS
==================================================

Implement a PaymentPort and provider adapters.

Mandatory methods:

A. Cash on Delivery (COD)
B. Development-only payment simulator
C. Online payment adapter boundary

Use Razorpay as the initial India-focused online payment
integration candidate where its documented API and merchant
account configuration support the selected checkout model.

Do not assume Delcu is the merchant of record.

Assume each merchant is responsible for its own payment
acceptance/settlement unless a later approved platform-level
settlement model replaces this assumption.

Keep payment-provider credentials server-side and scoped to
the configured merchant/payment account.

For COD:

- Place an order without claiming payment was captured.
- Track amount due.
- Support collection confirmation.
- Allow merchant to fulfill under its COD policy.

For development payment simulation:

- Simulate success.
- Simulate failure.
- Simulate timeout.
- Simulate delayed confirmation.
- Simulate duplicate callbacks.
- Simulate out-of-order events.

For online payment integration:

- Create provider order/payment intent server-side.
- Persist provider references.
- Verify payment result authenticity.
- Verify actual provider payment status and amount.
- Verify raw webhook signatures.
- Deduplicate webhook events durably.
- Handle out-of-order delivery.
- Support retries/reconciliation.
- Keep a payment event history.
- Prevent duplicate capture/order confirmation.
- Never treat a browser callback alone as proof of payment.
- Never log provider secrets.

Do not invent provider API idempotency guarantees.
Follow each documented endpoint's actual contract.

If real provider credentials or merchant onboarding are
unavailable, fully implement and test the adapter boundary,
document the exact blocked provider-sandbox checks,
and keep live payment activation disabled.

Do not mark real online payments production-ready without
completed provider sandbox and security verification.

==================================================
13. ORDERS
==================================================

Implement the complete order lifecycle.

Separate order, payment and fulfillment status.

Required:

- Durable order number unique within the store.
- Order placement.
- Customer order history.
- Order details.
- Merchant order listing.
- Merchant order details.
- Search/filter/pagination.
- Payment status.
- Fulfillment status.
- Cancellation.
- Refund initiation/status where supported.
- Order timeline.
- Internal merchant notes.
- Customer-visible status history.
- Inventory restoration according to explicit rules.

Ensure:

- One successful checkout produces one logical order.
- Duplicate requests do not create duplicate orders.
- A payment webhook cannot create the same order twice.
- Payment and inventory transitions remain consistent.
- Late payment after reservation expiry is handled safely.
- Unknown payment outcome is not retried blindly.
- Failed payments do not silently produce paid orders.
- Provider outages do not lose business state.

Use explicit transition rules.

Do not allow arbitrary status updates.

==================================================
14. FULFILLMENT
==================================================

Implement manual fulfillment for the first release.

Required:

- Mark order ready for fulfillment.
- Mark dispatched.
- Add carrier/reference text optionally.
- Mark delivered.
- Record COD collection separately.
- Cancel eligible orders.
- Record fulfillment history.
- Prevent invalid backward transitions.
- Audit every status change.
- Trigger appropriate notifications.

Do not integrate third-party courier APIs yet.

Preserve a clean fulfillment boundary for future shipping
provider integration.

==================================================
15. NOTIFICATIONS
==================================================

Use a notification abstraction.

Support:

- Merchant email verification.
- Password reset.
- Customer email verification.
- Store invitations.
- Order confirmation.
- Payment confirmation.
- Payment failure where appropriate.
- Order dispatch.
- Order delivery.
- Order cancellation.

Implement:

- Development outbox.
- AWS SES adapter.
- Durable notification outbox.
- Retryable delivery.
- Idempotent notification identity.
- Failure status.
- Safe logging.

A notification failure must not roll back a committed order.

Never duplicate order-confirmation emails on webhook retries.

==================================================
16. HEADLESS API CONTRACTS
==================================================

Build APIs that can serve:

1. Default Delcu merchant admin.
2. Default Delcu storefront.
3. Future Delcu AI-generated storefronts.
4. Future mobile clients.

Separate:

- Administrative APIs.
- Public catalog APIs.
- Customer-authenticated storefront APIs.
- Provider webhooks.

Use versioned endpoints.

Maintain accurate OpenAPI documentation.

Consistent:

- DTO validation.
- Error envelope.
- Pagination.
- Filtering.
- Sorting.
- Authentication errors.
- Permission errors.
- Conflict responses.
- Idempotency behavior.

Keep business rules inside application/domain modules.

Do not embed frontend assumptions or React dependencies
inside backend modules.

Design public contracts so a future storefront SDK can
consume them without bypassing authorization or pricing rules.

==================================================
17. MOCK/DEVELOPMENT MODE
==================================================

The backend must support rapid UI development later.

Preserve development adapter selection.

Provide:

- PostgreSQL-backed normal mode.
- Development memory/demo mode where safe.
- Deterministic demo seed data.
- Development mail outbox.
- Development payment simulator.
- Development object-storage adapter.

Production must reject unsafe demo/test providers.

All adapters must implement the same application contracts.

Do not fork business rules between mocked and real modes.

Where a business operation requires transactional semantics that
a simplistic memory adapter cannot faithfully provide,
either implement equivalent safe behavior or clearly restrict
that adapter to documented development scenarios.

Never weaken PostgreSQL-backed acceptance tests to make
memory mode pass.

Provide a command to start the complete backend demo.

==================================================
18. DATABASE AND MIGRATIONS
==================================================

Use Prisma and PostgreSQL.

Add migrations incrementally.

Never edit the already-merged Phase 0 migration.

Preserve existing IDs and data.

Use:

- Foreign keys.
- Tenant-scoped uniqueness.
- Check constraints.
- Transactions.
- Optimistic concurrency where appropriate.
- Audit/event tables.
- Idempotency constraints.
- Proper indexes.
- Exact minor-unit monetary columns.

All new tenant-owned records must be scoped correctly.

Test migrations against:

1. Empty database.
2. Populated Phase 0 fixture.
3. Repeated deployment.

No destructive schema reset.

No lossy data backfill.

No silent reassignment of historical owners.

If existing real merchant data is discovered and ownership
cannot be mapped safely, preserve it and report the precise
cutover blocker.

==================================================
19. REQUIRED END-TO-END TESTS
==================================================

Create realistic HTTP and PostgreSQL end-to-end tests.

At minimum:

FLOW A — MERCHANT
Signup → verify email → login → create merchant account →
create store → complete onboarding → create product →
upload images → configure inventory → publish store.

FLOW B — CUSTOMER
Open published storefront → browse collection →
view product → choose variant → add to cart →
register/login → add address → checkout → place order.

FLOW C — PAYMENT SUCCESS
Reserve inventory → initiate payment → simulate/verify
successful payment → confirm order → update available
inventory → persist payment/order events.

FLOW D — PAYMENT FAILURE
Initiate payment → failure/timeout →
preserve correct order state → release or reconcile stock
according to the defined policy.

FLOW E — COD
Place COD order → merchant confirms →
dispatches → delivers → records payment collection.

FLOW F — MULTI-TENANCY
Merchant A cannot access Merchant B's stores, products,
carts, customers, orders, inventory or payment records.

FLOW G — CONCURRENCY
Two shoppers attempt to buy the last available unit.
No overselling, duplicated order or duplicated charge.

FLOW H — IDEMPOTENCY
Repeated checkout request, webhook, fulfillment action
and notification retry do not duplicate business effects.

FLOW I — LIFECYCLE
Cancelled, expired, refunded and delayed-payment scenarios
preserve inventory and financial history correctly.

FLOW J — SECURITY
Expired/revoked sessions, CSRF, credential brute force,
IDOR, malformed webhook signatures, price tampering and
permission changes cannot bypass the rules.

Use real PostgreSQL for persistence/concurrency tests.

Use deterministic external-provider fakes for CI.

Do not call mocked provider tests a verified live gateway integration.

==================================================
20. DEMO AND VERIFICATION
==================================================

Create a reproducible backend demonstration.

Provide scripts or documented commands that:

1. Start PostgreSQL.
2. Apply migrations.
3. Seed a demo merchant and published store.
4. Seed realistic products, variants and images.
5. Seed appropriate shipping/tax/payment configuration.
6. Run the merchant API journey.
7. Run the customer API journey.
8. Complete a simulated payment.
9. Confirm the order.
10. Fulfill and deliver the order.
11. Verify inventory and order history.

Provide sanitized example API requests and responses.

The whole demonstration must be executable without
production credentials.

A working demonstration is mandatory.

==================================================
21. QUALITY GATES
==================================================

Before declaring completion:

- All existing Phase 0 tests still pass.
- All new unit tests pass.
- All HTTP integration tests pass.
- All PostgreSQL integration tests pass.
- All critical concurrency tests pass.
- All migrations validate and deploy.
- No migration drift.
- TypeScript checks pass.
- Production build succeeds.
- GitHub Actions is green.
- No unsafe demo authentication in production.
- No hardcoded provider credentials.
- No fake payment result can be accepted in production.
- No data leakage across tenants.
- No unsupported claim of tax/legal compliance.
- No unexplained skipped tests.

Maintain the existing modular monolith.

Do not introduce Kafka, Kubernetes, microservices or
other infrastructure just because they may be useful later.

Prefer the simplest correct implementation that preserves
the necessary business invariants.

==================================================
22. DOCUMENTATION AND HANDOFF
==================================================

Keep these documents updated:

AGENTS.md
docs/PRODUCT_REQUIREMENTS.md
docs/ARCHITECTURE.md
docs/DECISIONS.md
docs/IMPLEMENTATION_PLAN.md
docs/IMPLEMENTATION_STATUS.md

Also create:

docs/BACKEND_API_CONTRACTS.md
docs/COMMERCE_LIFECYCLES.md
docs/LOCAL_DEVELOPMENT.md
docs/BACKEND_E2E_TESTING.md

Record:

- Completed milestones.
- Implemented endpoints.
- Database migrations.
- Actual verification results.
- Remaining known limitations.
- External credentials needed.
- Provider sandbox tests still required.
- Latest commit SHA.
- Exact next task.

Do not mark incomplete work as complete.

==================================================
23. GIT AND DELIVERY
==================================================

Use the feature branch created from main.

Commit each verified slice separately with meaningful messages.

Push verified progress.

Create a draft PR targeting main.

Do not merge automatically.

Do not deploy to production.

If GitHub permissions prevent PR creation, report the
exact failure and provide the compare URL.

Continue executing subsequent backend milestones until
the full backend acceptance criteria pass or a genuine
external blocker prevents further safe progress.

Do not stop merely because one milestone has completed.

==================================================
24. FINAL DELIVERABLE
==================================================

Provide a final implementation report containing:

1. Completed backend modules.
2. End-to-end user journeys now working.
3. Database entities and migrations.
4. API endpoints and OpenAPI location.
5. Authentication and authorization behavior.
6. Catalog/inventory functionality.
7. Cart/checkout functionality.
8. Payment functionality, distinguishing:
   - COD
   - Development simulator
   - Verified provider sandbox
   - Unverified/live-blocked integrations
9. Order and fulfillment functionality.
10. Test results and coverage gaps.
11. Security findings.
12. Local demo instructions.
13. Latest commit.
14. GitHub Actions result.
15. PR link.
16. Remaining external requirements.

The backend is complete only when a merchant can create
and publish a store and a customer can successfully place
an order through the API, with correct inventory, payment,
order and fulfillment state.

After backend completion, STOP.

Do not implement the merchant admin UI or consumer storefront UI.

Those are the next separately authorized workstreams.
```
