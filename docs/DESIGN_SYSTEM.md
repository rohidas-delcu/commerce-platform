# Design system

## Approved reference and present boundary

The approved HTML prototype is a separate design reference. It is not included
in this repository or the imported milestone-1 backend archive. Its path, version,
assets and exact visual tokens are not recorded here because they are unavailable.
Do not invent them or treat backend seed/sample data as approved UI design.

Phase 0 contains no React implementation, frontend workspace or UI migration.
Do not modify the separate HTML mockup as part of this work.

## Decisions still needed before UI work

After explicit frontend scope approval, obtain the actual approved reference and
record its durable location/version. Extract and confirm its colors, typography,
spacing, layout, components, states, assets, responsive behavior and accessibility
requirements. These are pending specification items, not approved design tokens.
Record confirmations here and substantive decisions in `DECISIONS.md`.

## Existing backend constraints for future clients

- Preserve exact minor-unit money strings and format against the store currency;
  never round-trip prices through floating-point arithmetic.
- Treat draft/published stores and draft/active products as distinct states.
- Handle validation, forbidden, not-found and conflict responses explicitly.
- Use public catalog projections for storefronts; do not expose merchant APIs or
  assume demo headers provide production identity.

These constraints describe the existing API contract, not a new UI specification.

Backend branding now stores brandingName and an optional verified logo asset ID,
with a safe public metadata API. This defines data contracts only. No HTML mockup,
React screen, visual palette, layout or approved storefront design was modified.

## Subsequent admin UI branch (2026-10-31)

On `feature/commerce-admin-ui`, the user explicitly authorized continuing into the
merchant React UI after the backend delivery. The separate Commerce Studio HTML
prototype is available in the task's scratch workspace and informed the React
merchant workspace (DM Sans/Manrope, violet emphasis, pale surfaces, rounded
cards, responsive sidebar, auth hero, data tables, product/order drawers).

The exact approved prototype file identity, asset manifest, responsive screenshot
baseline and pixel-diff acceptance are **not** persisted in this repo, so visual
fidelity remains subject to human review. The prototype's fake auth/localStorage
models were *not* ported: the React UI uses real session/CSRF/PostgreSQL APIs.
The consumer storefront design and React migration remain separate future work.
See `docs/ADMIN_UI_STATUS.md` for the current UI checkpoint and tests.
