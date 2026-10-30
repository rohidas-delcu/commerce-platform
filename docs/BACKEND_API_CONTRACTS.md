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
Logo/media and shipping/payment onboarding configuration are still pending.

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
variant-specific pricing/lifecycle and media are not complete yet.

OpenAPI generation uses the Nest Swagger TypeScript plugin with dedicated DTO
files. Executed HTTP checks assert actual identity/store request schemas, password
length and cookie security scheme at `/docs-json`; the interactive viewer is `/docs`.
Mutation contracts document required Origin and x-csrf-token headers. For local
Swagger mutations, include the actual API origin in CORS_ORIGINS and supply the
CSRF token from bootstrap; do not relax origin checks.
