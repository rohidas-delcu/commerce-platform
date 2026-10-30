# Backend API contracts — implementation checkpoint

Swagger: `/docs`; API schemas are exposed by the current Nest DTO/controller set.
Legacy `/v1/admin` and storefront catalog endpoints remain as documented in
`apps/api/README.md`; real session authority is **not yet wired to merchant/store
permissions**. Do not treat arbitrary demo headers as real authentication.

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
| POST `/deactivate` | Currently 409: conservatively disabled until ownership reconciliation exists. |

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
