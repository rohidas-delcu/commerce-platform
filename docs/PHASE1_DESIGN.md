# Phase 1 — merchant authentication and store onboarding decision pack

**Status: proposal, not approved or implemented.** Audit date: 2026-10-30.
All recommendations, numeric policies, entities and endpoints below require review.
The user authorized design only. No application code, migrations or dependencies
are changed. Vite + React is the intended future admin technology, not permission
to build it or alter the separate approved HTML design.

## 1. Repository audit and prerequisite

Audited branch: `feature/milestone-1-foundation`, HEAD
`36c998812d43c4fdcb7f74487a304b5ff9e72dab`. Read all domain, application, HTTP,
infrastructure, configuration/bootstrap modules, Prisma schema and initial SQL.

**Phase 0 is not merged.** GitHub PR #1 is OPEN, with null mergedAt/mergeCommit.
Fetched `origin/main` is `3de3dc145a6c81d331b6861c3b7c138c21e2f9c1`
(the initial commit). Verified through `gh pr view 1 ...` and `git fetch origin main`.
Do not merge automatically; human Phase 0 approval/merge is an implementation gate.
The design uses the verified feature branch because main has no backend yet.
Historical passing tests remain historical evidence; no application tests were
rerun for this documentation-only audit.

| Existing contract | Required identity/onboarding change |
| --- | --- |
| `LocalDemoAuthGuard` validates an opted-in development header; controllers pass header strings | Verified session principal supplied by authentication adapter; never accept subject/merchant from request body/header as authority. |
| `CommerceService.ownedStore` compares `Store.ownerSubjectId` | Application authorization policy checks identity, account, store and active membership; replace owner-only listing with accessible-store query. |
| Repository port takes plain store IDs; some reads rely on prior service checks | Require trusted tenant context and store scope at repository boundary; recheck mutable authorization in write transactions. |
| Store has name, globally unique handle, IN/INR defaults, DRAFT/PUBLISHED | Add account FK, onboarding state, validated settings, branding references and settings version; onboarding completion is not publication. |
| Products/variants/movements already have store keys and SQL constraints | Preserve UUIDs, product versions, minor-unit money, composite FKs, SKU uniqueness and transactional stock writes. |
| Movement `actorSubjectId` and owner are arbitrary strings, no identity FK | Retain legacy provenance; new immutable actor identity/session attribution. No automatic claim based on legacy strings. |
| Domain errors plus `{statusCode,code,message}`, validation/CSRF not yet identity-aware | Keep envelope; add 401/403/429 and stable business reasons, safe field errors/request ID; never leak tokens. |
| `/health`, `/health/ready`, sanitized operational logger | Preserve health behavior; add durable security audit separate from minimal operational logging. |
| Runtime and memory repository refuse production | Keep refusal until real identity, fail-closed config, migration and security acceptance gates are approved. |

No identity, credential, session, merchant, membership, invitation, email delivery,
security audit or onboarding tables/modules currently exist. Store publication
currently checks ownership only. Country/currency checks validate syntax, not a
supported-country/currency registry. There is no store settings update contract.

## 2. Authentication recommendation and trade-offs

Recommend a **standards-based OIDC identity authority**, preferably a maintained
managed provider after explicit provider review, with email/password + verified
email and recovery as the initial baseline. Keep business tenancy/permissions in
Commerce. Provider choice is deliberately unresolved: compare cost at expected
users, region/data residency, exportability, breach controls, MFA, support/SLA,
email delivery, refresh revocation, account deletion and migration constraints.
If Delcu Identity already exists, assess its OIDC/operational maturity first.
Do not create another identity microservice as a Phase 1 shortcut.

| Method | Benefit | Cost/security implications and proposed disposition |
| --- | --- | --- |
| Email/password | Familiar, resilient to temporary mail delays after verification | Credential stuffing, hash/breach/recovery operations. Prefer provider-hosted credential entry; require verified email and breached-password controls. Baseline recommendation, pending approval. |
| Email OTP/passwordless | Removes password storage/recovery | Mailbox compromise, delivery latency, OTP brute force, phishing; email is not strong MFA. Optional later method unless product chooses it as baseline. |
| Google OIDC | Lower signup friction; no local password | Provider dependency, consent/brand configuration and account-linking takeover risk. Optional Phase 1 scope decision; never auto-link by matching email alone. |
| Local credential implementation | Full control, potentially easier residency | Highest long-term security/operations burden. Only if provider/Delcu options fail review; maintained libraries, Argon2id with benchmarked parameters, unique salts, breached-password checks and recovery delivery required. Do not hand-roll protocols/cryptography. |

OIDC integration uses Authorization Code + PKCE S256, exact redirect allowlist,
one-time state/nonce bound to the initiating browser, issuer/audience/signature/
expiry checks and bounded clock skew. Exchange codes server-side. Use stable
`(issuer, subject)` identifiers, not email, as identity linkage. Google and later
Delcu connections require explicit authenticated linking with recent reauth;
issuer migrations use a reviewed mapping, never email-based silent relinking.
Hosted identity screens may constrain visual branding: require approval before
accepting a vendor UX that differs from the separate mockup. Commerce-owned
email/password screens would require a separately reviewed provider API flow.

### Sessions and lifecycle

Recommend same-origin admin/API routing in deployment; Vite dev proxy mirrors it.
Use opaque server-side browser sessions, not bearer JWTs in localStorage. Browser
receives a short-lived opaque access cookie and a separately scoped rotating
refresh cookie; store only cryptographic hashes of high-entropy secrets. OIDC
provider tokens stay server-side, encrypted if retained. App refresh secrets are
not provider refresh tokens. Authorization is always Commerce's current state.
Proposed defaults: access 5 minutes, refresh idle 7 days, absolute session 30 days;
reauth freshness 5 minutes for credential/linking/ownership operations. Security
owner must approve/tune these before implementation.

Cookies: Secure, HttpOnly, host-only, no Domain, SameSite=Lax; refresh Path only
covers refresh/logout endpoints (proposed `/v1/auth`). Use `__Host-` only on Path=/ cookies, not a scoped
refresh cookie. Add GET `/v1/auth/csrf` to issue a browser-bound preauthentication challenge
and readable CSRF token before login/registration; rotate and bind it to the
authenticated session after login. Require that token in a custom request header.
All mutations including login/refresh/logout require trusted
Origin plus the appropriate preauthentication/session-bound CSRF token; OIDC callback validates state instead.
Disallow wildcard credentialed CORS, validate proxy trust and HTTPS routing;
HttpOnly does not remove XSS/CSRF risks. CSP and no third-party admin scripts are
frontend deployment prerequisites. Auth responses use Cache-Control: no-store.

Persist session ID, user ID, token family, refresh generation/digest, created/
last-used/idle/absolute expiry, reauth time, revokedAt/reason and minimal device
label. Rotation is an atomic compare-and-swap transaction; old secret reuse
revokes the whole family and records an event. Browser coordinates one refresh
across tabs; do not silently accept concurrent reuse. Network loss after rotation
can require re-login; document this baseline trade-off rather than introduce an
unbounded grace period. Retain spent-token digests until family expiry for replay
detection; rate limit unknown token probes without logging tokens.

Logout current device revokes its family and clears cookies; logout-all increments
identity session epoch and revokes all families. Password reset/compromise/global
identity suspension do likewise. Check current identity/account/membership status
on each protected request (no permission claims cached for token lifetime).
Revoke active local sessions immediately on known authority events; validate
signed provider events idempotently and reconcile missed events. Offline external
revocation cannot be guaranteed without provider introspection/event guarantees;
resolve the provider's revocation SLA before selection. Outages fail closed for
authentication; existing local sessions operate only within approved authority
freshness bounds, never via demo fallback.

## 3. Identity, merchant and membership model

Use separate logical modules inside the existing Nest application: Identity
(adapter/session management), MerchantAccess (accounts/memberships/policies), and
StoreOnboarding (settings/lifecycle). Domain policies have no controller/provider
SDK dependencies. Application ports wrap provider, mail/outbox, clock, audit and
repositories; share business policies between memory and PostgreSQL adapters.

| Proposed entity | Key constraints / role |
| --- | --- |
| Identity | Internal UUID, ACTIVE/SUSPENDED/DEACTIVATED, session epoch; human identity independent of any store. |
| IdentityConnection | Unique `(issuer,subject)` → identity; verified email metadata, never primary authorization key. |
| MerchantAccount | UUID, ACTIVE/SUSPENDED/DEACTIVATED; owns many stores, not an authentication credential. |
| MerchantMembership | Unique `(merchantId,identityId)`, ACCOUNT_OWNER or MEMBER, status/version. Account owner controls account and proposed inherited store-owner authority. |
| Store | Existing UUID plus merchantId FK; publication state retained; independent access/suspension and onboarding state/version. |
| StoreMembership | Unique `(storeId,identityId)` plus merchantId; OWNER/ADMIN/EDITOR/VIEWER, status/version. Composite FKs enforce store/account and account membership consistency. |
| Invitation | Merchant/store, normalized recipient email, role, creator, digest, expiry, status; unique pending invitation per scope/email. No bearer token stored raw. |
| OwnershipTransfer | Store, source/target account/identity, expected version, expiries and two-party confirmation; no implicit role edit. |
| Session / one-time challenge | Hashed secrets, expiry, purpose and consumedAt; transactional single use. Challenge types kept separate from session credentials. |
| SecurityAudit / Outbox | Durable events and delivery attempts; transactional insertion with business changes. No secrets/full request payloads. |

Proposed initial signup creates one identity and personal merchant account only
after verification (or lazily on first create-store); invite acceptance reuses an
existing identity and joins the inviting account without creating another account.
An identity can belong to multiple accounts/stores. Account membership alone gives
MEMBER no store access. Store invitation acceptance atomically creates the required
account MEMBER and scoped store membership. ACCOUNT_OWNER authority is explicitly
inherited; UI and last-owner logic must count it, not just explicit store rows.

### Authorization matrix (proposal)

| Permission | Account owner | Store owner | Admin | Editor | Viewer |
| --- | --- | --- | --- | --- | --- |
| Store/catalog/inventory read | Yes | Yes | Yes | Yes | Yes |
| Catalog/inventory write | Yes | Yes | Yes | Yes | No |
| Basic settings/branding/onboarding | Yes | Yes | Yes | No | No |
| Publish/unpublish | Yes | Yes | Yes | No | No |
| Invite/remove non-owner store members | Yes | Yes | No | No | No |
| Store ownership transfer / owner role changes | Yes | Yes, within same account | No | No | No |
| Account owners/status and cross-account store transfer | Yes + safeguards | No | No | No | No |

Controllers only authenticate, validate and call use cases. A central application
policy resolves `principal + merchant + store + permission`; scoped repositories
also enforce tenant keys. Return 404 for inaccessible resources, 403 for known
scope with insufficient permission, 401 for invalid session. Never trust a store
switcher selection or membership ID to establish authority. For writes, lock the
merchant/store authorization aggregate and recheck membership/status in the same
transaction as mutation/audit. Membership revocations use the same lock order
(account then store) so a request cannot commit after its authority is revoked.

Invitations default to 72 hours, single use, role bounded by inviter permission.
Acceptance requires authenticated, verified matching email plus token; consume
and create membership atomically. Resends revoke prior token. An email change does
not silently transfer pending invitations. Removal takes effect on the next
request without terminating unrelated-store sessions; cached UI permissions are
advisory. Reject self-escalation and assignment of account-owner via store invite.

All owner demotions/removals/transfers serialize on the account/store row and
require a remaining effective active owner. Require recipient acceptance, recent
reauth and proposed MFA for owner changes; notify both parties. Same-account
store-owner changes differ from transferring legal tenancy. Cross-account
transfer requires both account owners, complete membership review, recipient
acceptance and an atomic merchantId/FK update; keep store/product IDs, expire
invitations and revoke old account access. Recommend defer cross-account transfer
implementation until its legal/audit semantics are approved, rather than silently
support it via PATCH. Account owner rights cannot be removed by a store owner.

Security suspension must still work if it suspends the last owner: freeze affected
management and enter RECOVERY_REQUIRED, never auto-promote an administrator.
Recovery requires an audited platform procedure and proof, not demo subject/email
matching. Deactivation with owned assets is staged pending transfer/recovery;
retain audit references rather than cascade-delete commerce records. Store
suspension blocks management and public catalog (recommended, needs approval).
Identity suspension revokes all sessions; account suspension blocks all its stores.

## 4. Store onboarding lifecycle and screen contracts

Onboarding state is separate from DRAFT/PUBLISHED and product DRAFT/ACTIVE.
Propose NOT_STARTED → IN_PROGRESS → COMPLETED, with computed missing requirements
and versioned saved sections. Never trust a client-supplied completed-step list.

| Future screen / flow | Contract and states |
| --- | --- |
| Signup | Account form or redirect to authority; submitting, generic accepted, validation, throttled, unavailable. Signup does not grant store access. |
| Email verification | Pending delivery, resend cooldown, expired/consumed token, verified. Token consumption only on explicit POST confirmation; GET must not consume mail-scanner links. Redact URL tokens and use no-referrer. |
| Login | Generic failure, unverified/reverify, rate-limited, suspended, provider unavailable; validated relative returnTo prevents open redirects. MFA/step-up challenge if configured. |
| Recovery | Generic accepted for existing/nonexistent email, expired/reset token, password-policy error, completed → sign in again; no automatic login. Reset revokes sessions and notifies user. |
| Store wizard | Create draft once, then save information, country/currency, basic settings, branding and review; loading/saving/saved/conflict/offline states. Resume from server requirements across devices. |
| Store switcher | Only current accessible stores plus permissions/status; changing URL/store reruns authorization; removal while open clears cached store data and selects another permitted store. |
| Account settings | Profile, verified email-change confirmation, methods, sessions/device logout, reauth, suspension/deactivation constraints. Email change requires reauth and verification of new address; notify old address. |
| Store settings | Scoped settings version, branding, team/invitations, onboarding state and explicit publish action; show read-only/forbidden/conflict states. |

End-to-end: register → verify → sign in → choose/create merchant context → POST
store draft (atomic initial owner membership) → enter information → choose supported
country/currency → configure timezone/contact → branding → review/complete →
dashboard. An invited user instead accepts an invitation and selects that store.
Dashboard can be entered for an incomplete draft with a resume banner; publication
is a separate authorized action. No React/assets/visual tokens are implemented.
Obtain the actual separate HTML reference before designing visual components.

Proposed required fields: store name, handle, supported ISO country/currency pair,
IANA timezone, verified contact email, and branding display name. Logo optional;
use existing approved default presentation, not invented design. Branding uses
validated asset IDs from an approved upload/storage flow (type/size checks, scanning,
no executable SVG); arbitrary remote URLs must not trigger server-side fetches.
If uploads are deferred, keep logo unavailable rather than accept untrusted URLs.
Legal contact requirements and approved country/currency list need product/legal
approval. Current two/three-letter regex validation is insufficient.

Save per section with expectedVersion; 409 returns current version/missing fields,
never overwrites another administrator. Client retries create/complete with an
Idempotency-Key scoped to actor/operation, body hash and bounded retention (propose
24 hours). Different body with the same key returns 409. Handle suggestions are
advisory; global unique index decides races, returning HANDLE_TAKEN. Reserve handles
only when a verified user creates a store, not during anonymous registration.

Abandoned unverified registrations: propose purge challenges after 24 hours and
unverified local registration metadata after 7 days; never delete store data under
that rule. Incomplete verified stores persist until explicit archival; no silent
handle recycling. Resume shows authoritative stored values and missing steps.
Completion requires verified active actor/account and valid settings, but does not
require catalog content or publish. Publication additionally requires COMPLETED,
active store/account and `store.publish`; an empty catalog may be published under
this proposal. Existing published stores need explicit grandfathering approval.
After completion, permitted settings edits remain possible; suspend publication
if required fields become invalid. Changing currency once any products exist is
rejected (no implicit price conversion); changing a published handle needs a
separate redirect/URL policy, recommended defer. Settings eligibility is checked
server-side on every save and publication, not only wizard completion.

## 5. Migration, cutover and rollback plan

Do not edit the Phase 0 migration. After its reviewed merge, author additive
migrations and test against a populated Phase 0 backup fixture, not just empty DB.

1. **Inventory/backup:** count/checksum stores/products/variants/history, enumerate
   distinct legacy owner strings and published stores; rehearse restore. Obtain a
   reviewed owner→verified identity/account mapping outside request paths.
2. **Expand:** add identity/session/access/audit/outbox tables; nullable merchantId,
   onboarding/access fields and optimistic settingsVersion on Store. Index FKs,
   expiry cleanup and membership queries. Keep old owner/actor columns unchanged.
3. **Backfill:** idempotent batches per reviewed mapping, recording mapping version,
   operator and evidence. Create account-owner and store-owner memberships. Unknown
   owners become quarantined legacy accounts with no login-capable identity; keep
   records intact and mark access unresolved. Never assign all demo records to the
   first real signup or let a header/token claim `demo-merchant` ownership.
4. **Reconcile:** zero duplicate memberships, no orphaned store/account links,
   unchanged commerce IDs/counts/money/stock/history, all resolved accounts have an
   effective owner. Reconcile published-store onboarding/grandfathering exceptions.
   Block cutover if ownership mapping is unresolved; temporary public visibility
   of quarantined legacy stores requires explicit review, not an accidental default.
5. **Cut over under maintenance/write drain:** enforce merchant FKs/NOT NULL after
   resolving rows; atomic account+store+owner creation. Replace guard and controller
   header extraction with Principal, replace `ownedStore` and listing contracts,
   and enforce transactional policies in both adapters. Update every admin route,
   background job and future CLI use case, not just browser requests. Keep public
   projection; add explicit suspension/publication predicates. Inventory retains
   historical actorSubjectId with nullable new actorIdentityId and actorType; new
   authenticated writes require the latter, old events remain LEGACY.
6. **Harden:** production config requires real authority/session/CSRF/secrets/HTTPS
   configuration and PostgreSQL; abort on DEMO_AUTH_ENABLED or memory driver. Demo
   guard remains test/development-only and cannot be selected by production DI.
   Remove blanket production refusal only after separate security acceptance, not
   merely because an AUTH_MODE variable exists. Never fall back on provider failure.
7. **Contract later:** remove legacy owner reads only after reconciliation and an
   observation/review window. Preserve provenance columns/archive as required;
   do not dual-write conflicting ownership sources as permanent business logic.

Rollback is additive-schema retention plus write freeze/read-only mode or a prior
**real-auth-capable** release. Phase 0 is not a safe production rollback because
it has only demo identity. Do not reverse new ownership by lossy SQL downgrade.
Snapshot before cutover; restoring a snapshot after live writes requires explicit
data-loss reconciliation. Provider rollback must preserve stable identity links,
revoke incompatible sessions and keep all authorization checks fail closed.
Email/outbox retries are idempotent; provider outages must not roll back a committed
store or send duplicate invitations. Never put raw challenge/session tokens in
ordinary outbox JSON: encrypted delivery payload with short TTL and restricted
worker access, then deletion; digests remain in challenge records.

## 6. API proposal (not an implemented contract)

All business endpoints remain under `/v1`; UUID store/product paths and minor-unit
strings stay stable. Browser cookie credentials never appear in response JSON.
Authenticated responses include only self-safe identity and permitted scope data.
Same-origin API is the recommended transport; origin topology must be approved.

| Method/path | Input / response and authorization |
| --- | --- |
| POST `/v1/auth/registrations` | Hosted-authority flow handle/start; if approved API registration: email/password never logged; generic 202. Provider-specific contract finalized after choice. |
| GET `/v1/auth/oidc/:connection/start` / GET callback | Server-created state/PKCE and allowlisted returnTo; callback sets app cookies after verified code exchange. No roles from browser. |
| POST `/v1/auth/email-verifications/resend`, `/confirm` | Generic 202 resend; single-use challenge confirmation → 204. Provider-managed verification uses its audited equivalent. |
| POST `/v1/auth/password-recovery`, `/password-reset` | Generic 202 request; challenge/newPassword reset → 204, sessions revoked; adapter may use hosted equivalents. |
| POST `/v1/auth/login` | Only for an approved direct credential flow; generic 401 or next verification/MFA step, never custom proxying by default. Hosted baseline uses OIDC start instead. |
| GET `/v1/me` | Identity state, verified-email flag, merchant summaries; 401 if no valid session. |
| POST `/v1/auth/session/refresh`, `/logout`, `/logout-all` | CSRF-protected rotation/revocation, 204 with cookie updates. Current logout idempotent even if session expired. |
| GET `/v1/me/sessions`; DELETE `/v1/me/sessions/:id` | Own device metadata/revocation only; unrelated session IDs hidden. |
| PATCH `/v1/me`; POST `/v1/me/email-change`, `/deactivation` | Allowed profile fields; step-up for sensitive mutations; reject deactivation if ownership unresolved. |
| POST `/v1/admin/stores` | name, handle, countryCode, currencyCode, merchantId + idempotency key; verify account create permission; 201 store/onboarding/version/permissions. Never client ownerSubjectId. |
| GET `/v1/admin/stores` | Accessible stores grouped by account; bounded cursor pagination; invited/pending roles not active access. |
| GET/PATCH `/v1/admin/stores/:id/settings` | Information/settings/branding sections plus expectedVersion; store.settings.read/write. |
| GET `/v1/admin/stores/:id/onboarding` | State, saved sections, missing requirement codes, version and next action. |
| POST `/v1/admin/stores/:id/onboarding/complete` | expectedVersion + idempotency key; 200 COMPLETED or 409 missing prerequisites. |
| POST `/v1/admin/stores/:id/publish` | Existing path, new permission/prerequisite checks; no implicit complete. Unpublish endpoint proposed alongside it. |
| GET/POST `/v1/admin/stores/:id/invitations`; DELETE `.../:invitationId` | Member-management permission; role bounded, no raw token in response. |
| POST `/v1/me/invitations/accept` | token plus verified session; consume atomically; no arbitrary identity ID. |
| GET `/v1/admin/stores/:id/members`; PATCH/DELETE `.../:membershipId` | Expected version, bounded role changes, last-owner checks; invitation cannot grant ACCOUNT_OWNER. |
| POST `/v1/admin/stores/:id/ownership-transfers`; POST `.../:transferId/accept` | Reauth/MFA, recipient confirmation, expected version; initial implementation within merchant account only if approved. |
| GET `/v1/admin/stores/:id/audit-events` | Owner-only bounded cursor query, redacted security data. |

Existing product/inventory routes retain payloads but use principal/policies and
scoped persistence. Add permission summaries to store/me responses for UI hints,
not enforcement. Proposed extensions preserve `{statusCode,code,message}`; add
optional `reason`, `fieldErrors`, `requestId`, never secrets. Reasons include
EMAIL_UNVERIFIED, ONBOARDING_INCOMPLETE, HANDLE_TAKEN, LAST_OWNER, REAUTH_REQUIRED,
MEMBERSHIP_CHANGED. Return 429 with Retry-After, generic 401 auth failure, 404
inaccessible scope, 409 conflict; provider/storage outage is sanitized 503. Identity
endpoints must not reveal email existence through status, text or avoidable timing.
Final OpenAPI schemas, DTO limits and hosted-vs-direct route selection are a work
item after identity-provider approval; alternative routes above are not simultaneous
requirements to implement multiple authentication stacks.

## 7. Security and lifecycle risk matrix

Proposed limiter defaults require traffic tuning: login 5/account+20/IP per 15 min,
recovery/verification resend 3/account/hour, token consume 5/challenge, refresh
30/session/minute; global abuse ceiling as well. Use shared atomic PostgreSQL-backed
counters initially (no new service), expiry cleanup and trusted proxy IP parsing.
Do not rely on per-process counters. Count unknown emails using keyed hashes;
apply progressive delay, not attacker-triggered permanent account lockout.

| Risk | Severity | Required mitigation / acceptance evidence |
| --- | --- | --- |
| Credential stuffing/enumeration | High | Generic responses, breach checks, multi-key throttling, alerts, real load/timing tests; approved bot challenge escalation. |
| Mailbox/OTP compromise | High | OTP hash, expiry/attempt cap, no ownership step-up based on email alone; require stronger MFA for privileged changes. |
| OIDC linking/code injection | Critical | Issuer/subject uniqueness, state/nonce/PKCE, no email auto-link, recent reauth; adversarial callback tests. |
| Refresh theft/replay/race | Critical | HttpOnly hashed rotating family, CAS, replay revocation, session-device UI; concurrent refresh/retry tests. |
| CSRF/XSS/open redirect | Critical | Origin/CSRF/state, safe cookies, no localStorage tokens, CSP, allowlisted redirects; real browser tests. |
| Tenant IDOR / stale privilege | Critical | Central policies + tenant FKs + transaction recheck/locking; cross-account/store and revocation-race tests. |
| Last owner lost / suspension | High | Serialized mutations, inherited-owner calculation, freeze/recovery workflow; concurrent demotion and security-suspension tests. |
| Legacy store takeover | Critical | Reviewed mapping/quarantine, no demo claim, non-destructive backfill; populated migration/rollback rehearsal. |
| Provider/mail outage | High | Fail closed, retryable outbox, reconciliation, no demo fallback; outage/recovery tests. |
| Secret/PII leakage | High | Digest/encryption boundaries, audit redaction, access controls, no URL logging; logs/backups/export tests. |
| Retention and deactivation | High | Proposed 90-day security-event retention pending legal review; pseudonymize where permitted, retain commerce provenance; restoration/deletion tests. |
| Country/currency/branding edits | High | Supported registry, no silent money conversion, optimistic version, safe assets; post-onboarding tests. |

SecurityAudit records event ID/time, actor type/internal identity/session ID, target
account/store, action, outcome, reason, request correlation and bounded metadata.
No passwords/tokens/email bodies. Restrict IP/device data, pseudonymize/minimize
and set separate retention. Audit business mutations in their transaction; deny
sensitive mutations if mandatory audit persistence fails. Authentication failures
need bounded durable events and alerts without creating a logging DoS. Define an
alert/delivery outage procedure and restricted append-only audit DB role; operational
logger output is not the sole security record. No MFA recovery backdoor via support
or password reset; recovery assurance and retention need product/security approval.

## 8. End-to-end acceptance scenarios (planned, not executed)

1. Signup → email verification (replay/expiry/resend/mail scanner) → login → draft
   store → resume wizard on another device → complete → dashboard → explicit publish.
2. Existing and nonexistent emails return indistinguishable signup/recovery/login
   failure contracts; IP/account/challenge limits work across API instances.
3. OIDC state/issuer/audience/nonce/PKCE mismatch, reused code and malicious returnTo
   fail; Google link with matching email cannot steal an existing identity.
4. Single-device/logout-all, expired access/refresh, stolen old refresh, concurrent
   tabs and lost rotation response behave as specified; password reset/suspension
   invalidate sessions. Reauth/MFA requirements survive recovery flows.
5. One identity manages two accounts and stores; all other-account IDs and same-owner
   wrong-store product/variant/membership IDs fail without leaking data.
6. Every role executes every permission matrix row; UI-hidden controls alone cannot
   authorize calls; membership removal racing a mutation cannot commit stale access.
7. Invitation replay, wrong/unverified email, expiry, revoke/resend, duplicate accept
   and elevated role assignment fail; acceptance commits membership once.
8. Concurrent last-owner demotion/removal/transfer cannot orphan a store/account;
   security suspension freezes safely; transfer revokes old access and invitations.
9. Simultaneous duplicate handles: one creation; reused idempotency key: one store;
   stale settings: conflict; unsupported locale/currency and unsafe logo rejected.
10. Completed wizard does not publish; suspended/incomplete store cannot publish;
    catalog/product activation rules and public data projection remain unchanged.
11. Migration over populated Phase 0 preserves all UUIDs, money, stock and movement
    history; unresolvable legacy owners remain inaccessible; restart/backfill is
    idempotent; maintenance rollback never enables demo production auth.
12. Provider/email/DB/audit failures, outbox retries, restart and shutdown fail safely;
    logs and URLs do not leak secrets; provider-event replay and missed-event
    reconciliation preserve revocation guarantees.

Execute unit policy/state-machine tests, repository contracts against both adapters,
real PostgreSQL concurrency/FK/rollback tests, HTTP API tests and browser cookie/
redirect/CSRF tests (Playwright test harness, not React implementation). Fake only
the external authority/mail ports for deterministic CI; perform approved provider
sandbox end-to-end checks before release. Keep all Phase 0 checks mandatory.

## 9. Implementation breakdown and stop gates

These are implementation-ready work packages **conditional on approvals**, not
permission to start coding. Each needs migrations/DTO/OpenAPI review and tests.

| Package | Dependency / done evidence |
| --- | --- |
| P1-0: approve design and provider spike plan | Phase 0 reviewed/merged; product/security approvals below; costs, residency and provider sandbox contract recorded. |
| P1-1: additive identity/access schema + migration tool | Approved ownership mapping, row-preservation fixture, quarantine, idempotent backfill and restore rehearsal. |
| P1-2: authority adapter, email/outbox and browser sessions | Selected provider; OIDC, verification/recovery, rotation/revocation, limiter and audit tests; no production enablement. |
| P1-3: merchant/store access policies | Complete role matrix; replace all subject-string authority paths; transactional revocation and last-owner tests; both adapters. |
| P1-4: settings/onboarding API | Supported locale rules, branding strategy, resumability/idempotency, publication prerequisites and grandfathering verified. |
| P1-5: team/invitation/owner lifecycle | Approved boundaries/MFA/recovery; race tests and audit evidence; cross-account transfers deferred unless separately approved. |
| P1-6: frontend contract/sandbox handoff | OpenAPI, example sanitized responses, screen states and actual HTML reference mapped; no React code under current task. |
| P1-7: acceptance/cutover review | Full CI, provider sandbox/browser tests, threat review, migration rehearsal, observability/runbooks; security approval before production auth configuration can replace refusal. |

## 10. Product-owner/security decisions requiring approval

No row is approved by inclusion in this pack. Record approver/date/rationale and
supersede conflicting proposals before implementation.

| ID | Proposed decision / consequence |
| --- | --- |
| P01 | Review/merge Phase 0 PR #1; select the Phase 1 implementation branch after merge. |
| P02 | OIDC authority: existing Delcu Identity vs evaluated managed provider vs justified local stack; approve vendor, costs, residency, export/revocation SLA and hosted-screen UX. No vendor chosen. |
| P03 | Email/password baseline; include/defer OTP and Google; email verification required; MFA for owner/security operations and assurance-preserving recovery. |
| P04 | Merchant tenancy model, account-owner inheritance, fixed role matrix, invite rights, same-account vs cross-account transfers and legal ownership meaning. |
| P05 | Owner mapping evidence, unresolved legacy store visibility, and grandfathering existing published stores without changing product data. |
| P06 | Country/currency registry, required onboarding/legal fields, empty-store publication, logo/upload scope, currency/handle change restrictions. |
| P07 | Session/reauth durations, strict refresh reuse policy, limiter defaults, shared counters and authority freshness/outage behavior. |
| P08 | Suspension effects on public catalog, deactivation/last-owner recovery, event/PII retention and support escalation controls. |
| P09 | Same-origin deployment/cookies/CSRF topology, email delivery/storage choices, domain configuration and security operations ownership. |
| P10 | Confirm which P1 packages are in the first release and acceptance gates; authorize implementation separately. No React implementation is authorized here. |

Exact next task: review P01–P10, resolve the identity authority and ownership
semantics, and record approval. Do not implement, merge or deploy from this design.
