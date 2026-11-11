# ResKonnect Visual Studio + tactile design release — Phases 0–6

**Application:** ResKonnect (reskonnect.org / `resi-seek-app`); **not AssetGuard**.  
**Scope:** Existing ResKonnect public Living discovery, residence details, landlord/admin listing management, God Mode publishing, 360 Studio camera capture, and shared controls. This upgrade does not create a new scanner product, accommodation inventory, search algorithm, rating, or accreditation claim.

## Phase 0 — audit, editor contracts and release safety

- Keep existing searchable properties, reserves/applications, protected admin sections, Spotlight, curated Top 3, NSFAS evidence and SEO infrastructure.
- Retain published page IDs, RLS policies, MFA-gated publishing, revision history, drafts, rollback and audit trail.
- Use one atomic database operation for Trusted / Spotlight ordering.
- Repair Villa Ubuntu slug on rename. Old slug `ekhaya-junction` remains an alias and canonicalises to `villa-ubuntu-student-accommodation`.
- Current public listing fields never expose per-residence reservation or applicant counts.

## Phase 1 — high-confidence accommodation semantics

- Real listing institution acceptance on discovery cards, detail cards, premium Spotlight, Top 3, brand cards, nearby cards, ResMap and category grids.
- Specific tags (TUT, UP, TNC, UNISA, TSC etc.) are selected explicitly. University and TVET flags are broad categories; no institution is inferred from a nearby campus.
- NSFAS funding *acceptance* stays separate from official verified *accreditation*. No seeded student reviews or placeholder star averages.

## Phase 2 — God Mode visual publishing

- `/admin/studio`: real site iframe preview, selectable sections, desktop/tablet/mobile modes, section visibility, editable showcase copy, homepage ordering, draft revisions, publishing, audit and rollback.
- Find My Res search-to-conversion order is protected and intentionally not freely reordered.
- Page preview editing is available only in an authenticated same-origin God Mode MFA session; database RPCs separately check admin permission and AAL2.
- Editor preview link names and profile IDs are not publicly exposed through revision or page-layout APIs.

## Phase 3 — property operations studio

- Searchable property gallery with actual live residence card preview in compact, editorial and horizontal presentations.
- Edit confirmed institution tags, name/address/location, room types, rent, reported inventory, amenities, gallery and cover imagery, visibility and Spotlight.
- Rent changes revoke old price-verification flags instead of silently representing edited rent as verified.
- Existing authorization and accreditation workflows continue to determine what may be saved or displayed.

## Phase 4 — neomorphism, claymorphism, glass and physical surfaces

- Neumorphism: `.rk-neo-panel`, `.rk-neo-inset`, `.rk-neo-stat` for raised surfaces, recessed inputs and honest real-data counters.
- Claymorphism: `.rk-clay-card`, `.rk-clay-action` for gold 3D calls-to-action and tactile pressed feedback.
- Glass: `.rk-glass-panel` used for the student search dock, with contrast-preserving white foreground and reduced blur on mobile.
- Skeuomorphism: `.rk-physical-card`, `.rk-skeuo-frame`, `.rk-portrait-frame`, `.rk-device-shell` for accommodation photographs and God Mode device preview.
- Real camera: `.rk-scanner-frame` decorates the existing ResKonnect 360 Studio viewfinder, without claiming a new QR/barcode scanner or altering the camera permissions and capture pipeline.
- Brand remains ResKonnect navy `#071326`, rich blue `#2563EB` and gold `#F5B32F`; no third-party visual template, external animation dependency or fabricated data.

## Phase 5 — 20 meaningful interaction behaviours

| # | Requested behaviour | Production implementation |
| --- | --- | --- |
| 1 | Ease-out for entrances | `rk-soft-enter` and `rk-enter` |
| 2 | Dropdowns at 150–250 ms | Radix Select, Popover and Dropdown at 200 ms |
| 3 | Stagger rows by 30 ms | `rk-stagger-list` up to first six items |
| 4 | Scale to 0.97 on press | `rk-pressable` and tactile CTA states |
| 5 | Stretch moving knobs 12% | Radix switch thumb `rk-switch-stretch` |
| 6 | Stagger settling details | `rk-details-settle` residence card disclosures |
| 7 | Curved object movement | `rk-motion-arc` on residence arrow cue |
| 8 | Pulse to confirm success | `rk-success-pulse` only after confirmed admin writes |
| 9 | Ease-in-out movements | `--rk-ease-move`, no elastic everyday navigation |
| 10 | Popovers start at 0.95 | `rk-menu-enter` |
| 11 | Enter from trigger | Radix origin variables on portal content |
| 12 | Exit toward trigger | `rk-menu-exit` using same origin |
| 13 | No everyday bounce | Cubic Bézier transitions without overshoot |
| 14 | Do not tween while held | Instant `:active` transitions |
| 15 | Exits 20% shorter | 176 ms exit, 220 ms entrance |
| 16 | Overlap old and new states | View Transition snapshots crossfade |
| 17 | Masks for reveal and colour | `rk-mask-reveal` spotlight and selection badges |
| 18 | Crossfade icons + blur | `RkMorphIcon` for saved/published state |
| 19 | Rubber-band past bounds | One-shot `indicateRkBoundary` on blocked reorder buttons |
| 20 | Reuse same layout ID | `rk-layout-morph` + `runRkLayoutTransition` for visual preview and card layout mode |

All CSS transitions are nonessential enhancements: unsupported View Transitions gracefully fall back to immediate UI updates, and `prefers-reduced-motion: reduce` disables all visual-motion sequences. `prefers-contrast: more` increases borders and removes semitransparent glass.

## Phase 6 — verification and release gates

- `npm run backend:contracts` includes `admin-visual-studio-regression.test.mjs` and `reskonnect-tactile-motion-regression.test.mjs`.
- GitHub Actions validate TypeScript, production builds, security contracts, reservation integrations, SEO, cross-platform browsers, Android artifacts and backend RPC inventory.
- A merge requires every mandatory job to succeed. Production deployment must then be verified against the exact merged Git commit and canonical alias.
- Final manual acceptance by an authenticated God Mode administrator should exercise **Save draft → responsive preview → Publish → rollback**, edit a residence image, and test the old and new Villa Ubuntu URLs. ACI/CI coverage does not imply those real-user actions occurred.
- Failure mode: one unavailable visual registry must not affect normal public listing search; missing images retain the platform placeholder, and no student review or reservation total is manufactured.

### Tactile release architecture

`src/styles/reskonnect-tactile-motion.css` is the single source of timing and surface tokens. `src/lib/reskonnectMotion.ts` provides safe layout/motion fallbacks; `src/components/ui/RkMorphIcon.tsx` provides stable icon geometry. Existing Radix primitives are enhanced in place rather than copied or rewritten.

**Performance:** animations primarily use transform/opacity/clip-path; transitions are disabled on reduced-motion devices, shadows and glass are softened on small screens. JS motion code creates no polling loops, remote animation libraries or background network requests. SEO content and application form controls remain in the document without waiting for animation completion.
