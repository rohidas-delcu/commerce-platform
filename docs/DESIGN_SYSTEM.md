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
