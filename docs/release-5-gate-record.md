# Release 5 — Student Housing Intelligence Network — Gate Record

This record is the source-of-truth checklist for Release 5 (Phases 20–24) and the ResMap mobile rendering hotfix included before promotion to `main`.

## Gate 1 — Product scope and data contract

- Phase 20: live accommodation supply map.
- Phase 21: rolling demand heat intelligence.
- Phase 22: residence/property-partner analytics with residence-scoped authorization.
- Phase 23: institution accommodation pressure intelligence.
- Phase 24: investment/development opportunity signals presented as screening intelligence, not financial advice.
- Public intelligence surfaces expose aggregate/non-PII data only.

## Gate 2 — Spatial/mobile reliability

- ResMap retains live residence/campus overlays, filters, routing and 2D/3D controls.
- MapLibre is version-pinned instead of floating on the latest CDN release.
- iOS 16 and devices without WebGL2 use the MapLibre 4.7 compatibility runtime.
- Modern browsers use MapLibre 5.12.
- Critical MapLibre canvas/control CSS is shipped inline so a CDN stylesheet failure cannot leave a zero-layout/blank map.
- Full MapLibre CSS and JavaScript each have a second CDN fallback.
- Map canvas is remeasured after mount, after load, on ResizeObserver, orientation changes and VisualViewport changes to handle iPhone Safari browser-chrome resizing.
- A transient CDN failure no longer permanently poisons the MapLibre loader for the rest of the browsing session.

## Gate 3 — Security and privacy

- Elevated housing intelligence SQL is reached through fixed aggregate contracts.
- Property-partner analytics requires an authenticated residence-scoped service boundary.
- Housing intelligence helper privileges are explicitly constrained.
- No individual student profile, contact detail or row-level competitor CRM data is published in the public intelligence network.
- Supabase security-advisor findings introduced by this release must be zero before promotion. Pre-existing project findings are tracked separately and are not represented as created by Release 5.

## Gate 4 — Build, TypeScript, SEO and dependency verification

Required PR checks before merge:

1. `npx tsc --noEmit`
2. `npm run seo:check`
3. `npm run build`
4. production build artifact upload
5. `npm audit --omit=dev --audit-level=high`
6. repository dependency-security workflow
7. Golden Search/SEO workflow

Any red check blocks the merge and must be corrected on the feature branch.

## Gate 5 — Promotion and production verification

- Merge only after all required GitHub checks are green.
- Verify the exact merge SHA deploys successfully to both Vercel projects linked to `resi-seek-app`.
- Verify the production custom domain serves the promoted build.
- Verify the production `housing-intelligence` Edge Function remains ACTIVE and its network payload returns HTTP 200.
- Verify Release 5 migrations/functions remain present and callable under their intended authorization boundaries.
- Verify no new Release 5-specific Supabase security-advisor finding appears after promotion.

Release 5 is complete only when Gate 5 is satisfied.
