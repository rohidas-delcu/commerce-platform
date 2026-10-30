# Backend API contracts — implementation checkpoint

Swagger: `/docs`; API schemas are exposed by the current Nest DTO/controller set.
Legacy `/v1/admin` and storefront catalog endpoints remain as documented in
`apps/api/README.md`; real session authority is now wired through `/v1/merchant` below; the legacy
demo namespace is restricted to quarantined development stores. Do not treat arbitrary demo headers as real authentication.

## Identity HTTP slice (PostgreSQL only)

All routes below are under `/v1/auth`. Responses use the existing error envelope.
`GET /csrf` creates a short-lived anonymous browser session and returns csrfToken.
Every POST/PATCH/DELETE requires that cookie, an allowlisted Origin, and the token
in `x-csrf-token`. Login rotates to an authenticated session and new csrfToken.
Tokens/cookies are never returned as ordinary bearer credentials in response JSON.

| Method/path | Body / behavior |
| --- | --- |
| POST `/signup` | email, password (15–128 characters), name; generic accepted message, encrypted verification mail staged. |
| POST `/verification/resend` | email; generic message; rate limited. |
| POST `/verification/confirm` | token; single-use expiring challenge. |
| POST `/login` | email,password; verified active identity only; generic 401 failure. |
| GET/PATCH `/me` | Self profile; PATCH name only. No password hashes returned. |
| POST `/session/refresh` | Rotate session secret and CSRF; replay revokes family. |
| GET `/sessions` | Own unexpired active sessions (up to 100). |
| DELETE `/sessions/:id` | Revoke owned session only; no foreign session disclosure. |
| POST `/logout`, `/logout-all` | Revoke current/all identity sessions and clear cookie. |
| POST `/password/forgot` | email; generic message, encrypted reset mail staged. |
| POST `/password/reset` | token,password; consume once, revoke sessions. |
| POST `/password/change` | currentPassword,password; revoke sessions and outstanding challenges. |
| POST `/deactivate` | Blocks last effective account owners; otherwise removes memberships and revokes sessions without deleting provenance. |

Session is opaque, HttpOnly, SameSite=Lax, host-only, Path=/; Secure and __Host-
name in production configuration. Current runtime still refuses production.
Authenticated session idle lifetime 30 minutes, absolute 7 days; anonymous lifetime
15 minutes. Refresh before expiry; there is no separate long-lived refresh token.
Strict stale-secret refresh revokes the family, so clients must serialize refresh.
Lost refresh responses may require login again. Challenge verification TTL 24 hours;
reset TTL 30 minutes. High-entropy challenge/session secrets persist as SHA-256
digests; mail payloads are AES-256-GCM encrypted for delivery.

Not implemented: merchant access, customer auth, checkout/order/payment APIs.
This contract document must expand with each verified slice.

## Session-authenticated merchant APIs

All `/v1/merchant` routes use the same cookie/Origin/CSRF requirements; no identity
header establishes authority. Central policy: ACCOUNT_OWNER inherits store rights;
STORE_ADMIN can manage catalog/inventory/settings/publication; STORE_EDITOR can
write catalog/inventory; STORE_VIEWER can read. Only account owners manage members.

- POST/GET `/accounts` (name); GET `/accounts/:id/members`.
- PATCH/DELETE `/accounts/:id/members/:identityId` (ACCOUNT_OWNER or MEMBER).
- POST `/accounts/:id/suspend`, `/resume`; recovery-required accounts cannot self-resume.
- POST `/accounts/:id/invitations` (email, role, optional storeId); GET same path;
  DELETE `.../:invitationId`; POST `/invitations/accept` (token).
- POST `/stores` requires merchantId/name/handle/countryCode/currencyCode and
  `Idempotency-Key` (8–100 safe characters). Same key/input returns original store;
  different input conflicts. GET `/stores` and `/stores/:id` are switching contracts.
- PATCH `/stores/:id/settings` accepts expectedVersion plus name, contactEmail,
  brandingName, timezone, countryCode/currencyCode. Currency freezes once products exist.
- POST `/stores/:id/onboarding/complete` (expectedVersion); publication remains DRAFT.
- POST `/stores/:id/publish`, `/unpublish`, `/suspend`, `/resume`, `/archive`.
  Archive requires unpublished state; no data deletion. Publish requires completion.
- PATCH/DELETE `/stores/:id/members/:identityId` (STORE_ADMIN/STORE_EDITOR/STORE_VIEWER).
  Account-owner inherited rights cannot be revoked through a store membership route.
- GET/POST `/stores/:id/products`; PATCH `/stores/:id/products/:productId`;
  POST `.../:productId/activate`; POST `/stores/:id/variants/:variantId/stock-adjustments`;
  GET `/stores/:id/inventory-movements`. Existing validated commerce DTOs apply.

Lists currently return bounded arrays (max 100), not a completed cursor-pagination
contract. No API to claim quarantined legacy ownership or transfer legal tenancy.
Supported country/currency pairs: IN/INR, US/USD, GB/GBP, CA/CAD, AU/AUD; these are
locale validation only, not a claim of supported shipping/tax/payment jurisdictions.
Store logo/branding asset settings remain pending; product media and shipping/payment
configuration APIs are described below.

## Product lifecycle/search checkpoint

Merchant GET `/stores/:id/products` supports query, collection (legacy metadata
filter), status DRAFT/ACTIVE/ARCHIVED, sort created/name/price_asc/price_desc, limit
1–100 (default 25), offset 0–10000; returns items,limit,offset,nextOffset.
Public listing accepts the same filters except status (always ACTIVE), preserves
store/products and adds pagination. Prices sort as exact integers. Full cursor
pagination remains pending; the offset search window is currently bounded.
GET merchant `/stores/:id/products/:productId` and public
`/v1/storefront/:handle/products/:productHandle` provide details. Merchant POST
`.../:productId/deactivate` returns DRAFT; `.../:productId/archive` returns ARCHIVED.
Archived products cannot be implicitly reactivated or exposed publicly.
SEO accepts seoTitle (70 chars) and seoDescription (320 chars). Collections,
media are described below.

OpenAPI generation uses the Nest Swagger TypeScript plugin with dedicated DTO
files. Executed HTTP checks assert actual identity/store request schemas, password
length and cookie security scheme at `/docs-json`; the interactive viewer is `/docs`.
Mutation contracts document required Origin and x-csrf-token headers. For local
Swagger mutations, include the actual API origin in CORS_ORIGINS and supply the
CSRF token from bootstrap; do not relax origin checks.

## Variant metadata checkpoint

Merchant POST `/stores/:storeId/products/:productId/variants` accepts name, SKU,
optional active, priceMinor/compareMinor and options (up to 10 string key/value
pairs). New variants start at zero stock; use the stock-adjustment endpoint.
PATCH the same path plus `/:variantId` updates those metadata fields; stock is
forbidden. priceMinor:null removes the override and clears compare price unless
an invalid explicit compare price is supplied (400). Options/name/SKU are validated;
SKUs remain unique per store. Public variants omit inactive entries and expose
explicit options/effective price/compare price, never SKU. Last active variant
cannot be deactivated while the product is ACTIVE. Product must be deactivated
first. Archived products' variants cannot change. No physical variant deletion.

## Collections

Merchant GET/POST `/stores/:storeId/collections`; GET/PATCH `.../:collectionId`;
POST `.../:collectionId/archive`. Create fields: name/handle, optional description,
featured and position. Mutations of an existing collection require expectedVersion.
GET `.../:collectionId/products` lists all linked products for authorized admins.
PUT `.../:collectionId/products/:productId` accepts expectedVersion/position; DELETE
same path accepts expectedVersion. Link edits increment collection version and
reject wrong-store products. Positions are non-negative integers; ties use IDs.

Public GET `/v1/storefront/:handle/collections` supports query, featured=true/false,
limit and offset; returns collections/pagination. GET the path plus
`/:collectionHandle` returns safe collection/products/pagination, using link
position by default (explicit supported product sort overrides it). Only active
collections and active products of published, available stores are public.
Archives preserve links/history and disappear from public APIs. No arbitrary
restore or physical deletion. Legacy Product.collection text remains independent.

## Product image storage

Merchant cookie + CSRF + `catalog.write`, under `/v1/merchant/stores/:storeId`:
`POST media/reservations` accepts `{contentType,size,checksum}` (PNG/JPEG,
5 MiB maximum, SHA-256 hex), returns assetId and 15-minute PUT URL/headers.
Upload those exact bytes, then `POST media/:assetId/complete`. Completion decodes
and verifies the object; a reservation alone never publishes media.
`PUT products/:productId/images` accepts `{expectedVersion,assetIds,
primaryAssetId?,altTexts?}`, atomically replaces the ordered images (max20).
`DELETE media/:assetId` refuses referenced assets; detach first. Repeat delete is
safe. Public product images contain only id/url/altText/primary. `GET /v1/media/:id`
requires a COMPLETE asset linked to an active product in an available published
store. Unlinked assets are private. Local capability uploads exist only in explicit
development mode; they cannot authorize commerce operations. S3 live verification
is outstanding; deterministic SDK boundary tests are not a live integration.

## Inventory reservations

Merchant cookie/CSRF plus `inventory.write`, under
`/v1/merchant/stores/:storeId/inventory`:
`POST reservations` with `{key,lines:[{variantId,quantity}],ttlSeconds?}` (60–1800,
default900); identical store/key/input returns the original durable hold, changed
input409. Published available store and active products/variants required.
`GET reservations/:id` permits store readers. `POST reservations/:id/release` and
`POST expire-reservations` release once; expiry processes at most100 due holds.
Stock adjustments cannot reduce on-hand below reserved. Public stock reports
available quantity and excludes the internal reserved counter. Internal commitment
is reserved for the future checkout/order application flow; no HTTP client may mark
an order paid or arbitrarily invoke stock commitment. Expired holds never commit;
expiry is rechecked after acquiring database locks. Conservative holds remain
reserved until explicit expiry processing; automatic scheduling is pending.

## Store customer accounts

Base `/v1/storefront/:handle/customer`. Only active merchant-managed published
stores accept customer accounts. `GET auth/csrf` returns CSRF and a host-only cookie
`delcu_customer_<store UUID>` (production Secure `__Host-` prefix; production disabled).
Every mutation requires this cookie, allowlisted Origin and x-csrf-token. Use
credentialed fetch or a same-origin BFF; no cookie sharing across unrelated domains.

Public-with-CSRF operations: `POST auth/signup` `{email,password,name}`;
`auth/verification/resend` `{email}`; `auth/verification/confirm` `{token}`;
`auth/login` `{email,password}`; `auth/password/forgot` `{email}`;
`auth/password/reset` `{token,password}`. Verification/reset tokens are store-scoped,
one-time and absent from API responses. Challenges stage encrypted development mail.
`POST auth/refresh` rotates; reuse revokes the family. Authenticated operations:
`POST auth/logout`, `auth/logout-all`, `auth/password/change`
`{currentPassword,password}`; `GET auth/sessions`, `DELETE auth/sessions/:id`;
`GET profile`, `PATCH profile` `{name}`. Profile excludes credential material.
A customer cookie grants no merchant API access, even if renamed.

`GET/POST addresses`; `PATCH/DELETE addresses/:id`. Create/full edit fields:
`{name,line1,line2?,city,region,postalCode,countryCode,phone,isDefault?}`.
Edit/delete require expectedVersion (delete body `{expectedVersion}`). Max20;
first becomes default. Selecting a new default increments the former default's
version. Omitted isDefault on edit preserves it; clear by choosing another default.
Deleting a default selects the oldest remaining address. No cross-store access.
`GET wishlist?limit=&offset=` returns safe active public products;
`PUT/DELETE wishlist/:productId` are idempotent, bounded at500 saved products.
Wishlist does not expose internal SKU, merchant or audit fields. Customer order
history/detail APIs are described below.

## Guest/customer carts

Base `/v1/storefront/:handle/cart`. First obtain the store customer `auth/csrf`
session, including for guests; all mutations require its Origin/CSRF policy.
`POST /cart` creates/resumes; guests receive an additional host-only HttpOnly
`delcu_cart_<store UUID>` capability cookie. This capability is not a customer
identity. `GET /cart` selects the authenticated active cart or the guest capability.
Ownership/customer IDs, secret digests and SKU are never returned.
`PUT items/:variantId` `{expectedVersion,quantity}` sets absolute quantity 1–999;
`DELETE items/:variantId` or `DELETE items` uses `{expectedVersion}`. Max100 lines.
Prices, totals and stock are read on the server; client price fields are rejected.
`POST refresh` `{expectedVersion}` acknowledges current server prices.

Responses contain cart id/status/version/expiresAt, safe items, currencyCode,
subtotalMinor and structured validation (UNAVAILABLE, STOCK_SHORTAGE, PRICE_CHANGED).
This cart subtotal is not a checkout total. The separate estimate endpoint applies
configured shipping/tax/discounts; durable checkout/order snapshots are below.
A current quote never authorizes stock allocation; checkout must revalidate/reserve.
`POST merge` after customer login uses `{expectedVersion,guestVersion}`; combines
same-variant quantities atomically, rejects >999/100 lines, marks the guest merged
and clears its cookie. Retrying does not add quantities twice. Inactive/short-stock
merged lines remain visible as invalid choices for resolution, without reserving.
A guest cart expires seven days after creation; owned carts expire after seven days
without mutation. Expired carts cannot mutate; POST creates a fresh cart. Physical
retention cleanup awaits the worker. Customer/guest APIs require PostgreSQL.


## Shipping/tax policy and estimates

Merchant `GET/PUT /v1/merchant/stores/:id/pricing`; writes need `store.settings`,
Origin/CSRF and the current policy `version` (0 for initial creation). Shape:
`{version,shipping:[{id,name,countries,rateMinor,freeAboveMinor,active}],
tax:{mode,shippingTaxable,rates:[{countryCode,basisPoints}]},payments:{cod,simulator}}`.
All money fields are minor-unit strings; freeAboveMinor is an explicit string or null.
Countries currently IN/US/GB/CA/AU. Rates use integer basis points (no invented tax
rates). NONE requires empty rates; other modes require explicit destination rates.
The simulator flag can only be enabled in development. Flags do not process payments.
Draft policies may be incomplete. Completion/publication requires an active shipping
method, enabled payment flag and tax coverage for shipping destinations. Unpublish
before disabling checkout readiness. Policy writes are versioned and audited.

`POST /v1/storefront/:handle/cart/quote` with store customer/guest cookies and CSRF:
`{expectedVersion,shippingMethodId,shippingAddress:<full address>}`. Returns itemized
subtotalMinor/discountMinor/shippingMinor/taxMinor/totalMinor, currencyCode,
cartVersion/policyVersion and `estimate:true`. No caller-supplied amounts or direct
coupon inputs are accepted; the current cart coupon is read on the server. Missing/inapplicable configuration409; invalid/empty cart409.
Final checkout must revalidate/recalculate and persist snapshots; this response is
not a stock guarantee, payment acceptance or durable checkout. Coupon application and durable checkout lease/redemption APIs are described below;
a cart estimate alone does not consume or reserve coupon quota.

## Durable customer checkout

Base `/v1/storefront/:handle/customer/checkouts`. Verified store customer session,
Origin/CSRF for mutations; initial checkout requires login/guest-cart merge.
`POST` with `{cartId,expectedCartVersion}` and stable Idempotency-Key creates DRAFT.
Same key/input returns the checkout; changed input409. One active checkout per cart.
`GET :id` resumes and processes due expiry (releasing a hold). Only the owning
customer may read or mutate; cross-customer/store access404. No merchant SKU exposed.
`PATCH :id` with `{expectedVersion,contactEmail?,contactName?,shippingMethodId?,
shippingAddress?}` saves progress; at least one setting required. Any READY edit
atomically releases its hold and clears the quote before returning DRAFT.
`POST :id/reserve` `{expectedVersion}` recalculates authoritative catalog/policy
amounts, snapshots item/contact context and reserves stock (15-minute default).
Idempotent retry of the preceding quote version returns the same hold without
reserving twice. Invalid catalog/configuration or insufficient available stock409.
`POST :id/cancel` `{expectedVersion}` releases once and closes the checkout.
DRAFT expires24h after creation; READY expires with its hold. Closed/expired edits
fail409. On-demand expiry and reservation scans work; scheduled workers are pending.
READY is not an order, payment or committed sale. The COD placement endpoint below
revalidates current cart/catalog/policy and commits atomically.


## COD placement and order reads

`POST /v1/storefront/:handle/customer/checkouts/:id/place`
`{expectedVersion,paymentMethod:"COD"}` with Idempotency-Key, verified customer
cookie and CSRF. Requires READY/nonexpired hold and enabled COD policy. Revalidates
catalog, cart/version, currency and policy; changed data409 requires a new quote.
Same successful key/input returns the existing order without duplicate stock/order/
outbox effects; changed input under a used key409. No caller amounts are accepted.
Placement atomically commits held stock, immutable order/items/tax/contact/address,
per-store order number, source checkout/cart and one PENDING notification record.
COD begins `paymentStatus:DUE`, full amountDueMinor and paidMinor0; it does not claim
capture or cash collection. Notification staging is not email delivery.

`GET /v1/storefront/:handle/customer/orders` (limit/offset/status/query) and `/:id`
returns only the owning customer's order history/detail, immutable snapshots, separate
order/payment/fulfillment states and safe timeline. SKU/actor identity/placement keys
are excluded. Completed checkout GET/start replay includes its orderId.
`GET /v1/merchant/stores/:storeId/orders` and `/:id` use central `orders.read`,
initially ACCOUNT_OWNER/STORE_ADMIN only. Merchant detail includes internal SKU and
actor references. Store editors/viewers do not inherit order/customer PII access.
Manual cash collection/fulfillment/cancellation are described below; refunds and
other payment methods remain pending. Transactional order APIs require PostgreSQL; memory mode explicitly refuses.


## Manual fulfillment, COD collection and cancellation

Owner/admin `orders.manage`, merchant session + Origin/CSRF, base
`/v1/merchant/stores/:storeId/orders/:orderId`. Commands use body
`{expectedVersion,key}`; key is a stable8–100 character operation key. Same key/input
returns current order without repeating effects; different input under a used key409.
`POST ready`, then `POST dispatch` (optional carrier/reference text), then `POST deliver`.
Backward/invalid transitions409. Delivery alone does not mark COD paid.
`POST collect-cod` adds amountMinor and requires DELIVERED plus the exact outstanding
amount. This is an audited merchant report of cash received, not gateway capture.
Order becomes COMPLETED with payment PAID/paidMinor=total/amountDue0.
`POST cancel` adds nonempty reason, permitted only while unpaid and undispatched.
It restores committed stock exactly once, preserves financial snapshots and sets
CANCELLED/VOID/due0. Dispatched/delivered cancellations/refunds are not implemented.
`POST notes` adds a private note (max2000), including on closed orders. Notes/unknown
internal events never appear in customer history; dispatch carrier/reference does.
Every command uses transaction locks, optimistic versions, immutable events and a
unique durable command identity. Notification intents are staged; no email delivery
is claimed. Store editors/viewers cannot execute these order commands.


## Coupons and bounded quota

Owner/admin `discounts.manage`, merchant cookie + CSRF, base
`/v1/merchant/stores/:storeId/coupons`: `POST`, `GET`, `GET :id`, `PATCH :id`,
`POST :id/archive`. Create `{code,kind:"PERCENTAGE"|"FIXED",value,active?,startsAt?,
expiresAt?,maxUses?,perCustomerLimit?,restoreOnCancellation?}`. Percentage value is
basis points1–10000; fixed value is an exact positive minor-unit string. Code is
normalized uppercase, store-unique and immutable. Optional dates/limits may be null.
Edits use expectedVersion; archive deactivates without erasing history. Defaults:
active true, no dates/limits, restoreOnCancellation false. Detail reports consumed
uses and active heldUses separately. Cross-store code/ID access is denied.

`POST /v1/storefront/:handle/cart/coupon` `{expectedVersion,code}` and `DELETE` with
`{expectedVersion}` apply/remove without stock/quota reservation. Cart/estimate shows
server discount, discounted subtotal and COUPON_INVALID validation when ineligible.
Customer-limited codes require an owned authenticated cart. At merge the owned cart's
coupon wins; otherwise the guest coupon carries over and is revalidated, never stacked.

Checkout reserve leases coupon capacity with the stock deadline; global/per-customer
limits include other live leases and un-restored redemptions. Own quote retries do
not count twice. Placement rechecks version/eligibility/expiry after locks and consumes
lease + immutable redemption with order/stock in one transaction. Coupon expiry or
changed eligibility409 requires explicit resolution/requote; no silent higher charge.
Checkout cancellation/expiry releases its unconsumed lease. Order cancellation restores
consumed usage only when the purchase-snapshotted restoreOnCancellation flag is true;
later policy edits do not rewrite past purchases. Release records are immutable.

Zero-total orders use paymentStatus NOT_REQUIRED, paid0/due0, and complete on delivery.
They never record COD collection or payment confirmation. Positive COD totals retain
the separate delivered-then-cash-collection workflow. Production remains disabled.
