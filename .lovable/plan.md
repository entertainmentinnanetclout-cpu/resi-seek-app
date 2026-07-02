# Plan: Find My Res Marketing Slider, Vibrant Redesign & Admin Diversification Upgrade

## Phase 1 — Find My Res: Promotional Slider

**Goal:** Add a curated "spotlight" carousel above the category rails to shine on featured residences.

- New component `src/components/findmyres/ResidenceSpotlightSlider.tsx`
  - Autoplaying embla carousel (5s), 1 slide desktop / 1 mobile, arrows + dots
  - Large hero image, gradient overlay, residence name, price, location, "Featured" / "NSFAS" / "TUT" badges, CTA → residence detail
  - Data source: `residences` where `is_spotlight = true` (new flag) OR fallback to `is_featured = true` limited to 8
- Slot on `src/pages/FindMyRes.tsx` between `SmartSearchBar` and `CategoryRail`
- Admin toggle: add "Spotlight" switch to `AdminResidences.tsx` row actions + residence edit form

## Phase 2 — Residence Card & List Redesign (vibrant)

**Goal:** Replace the mostly white/blue palette with a warm, energetic ResKonnect palette while keeping semantic tokens.

- Extend `src/index.css` design tokens (HSL only):
  - Add `--accent-coral`, `--accent-amber`, `--accent-mint`, `--accent-violet`
  - New gradients: `--gradient-spotlight`, `--gradient-card-vibrant`, `--gradient-price-tag`
  - Category-specific accent tokens (Flats=violet, Communes=coral, Residences=blue, Rentals=mint)
- Register tokens in `tailwind.config.ts`
- Redesign `ResidencePropertyCard.tsx`:
  - Gradient price pill (coral→amber), category color strip on card top edge
  - Larger image (aspect 4:3), softer rounded-2xl, layered shadow-premium
  - Badges (NSFAS / TUT / TVET / Private) in distinct hues instead of all blue
  - Amenity icons pill row with tinted backgrounds
  - Animated hover: subtle scale + colored glow matching category
- Redesign list container in `FindMyRes.tsx`:
  - Category rails get a colored underline matching the category token
  - Section headers use gradient text
  - Empty state gets an illustrated vibrant panel
- Update `CategoryRail`, `CategoryHeroSelector`, `ActiveFilterChips`, `FilterBottomSheet`, `SmartSearchBar` to consume vibrant tokens (no hardcoded colors)
- Landing hero + `HeroCarousel` accents refreshed to match (color pass only, no layout change)

## Phase 3 — TVET & Private Diversification (data + admin)

**Goal:** Mark every existing residence as TUT by default, and let admins classify TVET/Private.

- SQL pack `docs/DIVERSIFICATION_ADMIN_SQL.sql`:
  - Backfill: `UPDATE residences SET accepts_university = true WHERE accepts_university IS NULL`
  - Add `is_spotlight boolean default false`, `spotlight_rank int`
  - Add `institution_types text[]` shim + view exposing accepts_* flags
  - RLS unchanged; grants refreshed
- `AdminResidences.tsx` upgrades:
  - New "Audience" column with 3 checkboxes (University / TVET / Private) editable inline + in edit dialog
  - Bulk-edit toolbar: select rows → mark as TVET / Private / Spotlight
  - Filter tabs: All | TUT | TVET | Private | Spotlight
- Public filter: extend `useResidenceFilters` + `AudienceSelector` to filter by audience tri-toggle
- Applications: `AdminApplications.tsx` gets an "Institution Type" column + filter (TUT/TVET/Private/Other) from `applications.institution_type` (add column if missing via same SQL pack)

## Phase 4 — Admin Dashboard Deep-Scan Upgrade

**Goal:** Bring every admin surface up to the new UI language and close functional gaps found in a deep scan.

Deep scan targets (files to audit + upgrade):
- All `src/pages/admin/*.tsx` — apply vibrant tokens, consistent StatCard, unified header pattern
- `AdminLayout.tsx` — colored hub icons, gradient active state, role badge polish
- Hub pages (`AdminOperationsHub`, `AdminCommerceHub`, `AdminMediaHub`, `AdminSystemHub`) — matching tab styling, sticky tab bar, count badges per tab

Functional additions discovered / required:
- **Operations Hub:** Spotlight tab (drag-order featured residences), Audience bulk-edit, TVET/Private badges everywhere
- **Applications:** institution_type filter, funding_type filter chip row, quick actions (approve/reject/message) already exist — wire to new toast/error helpers
- **Portals:** surface last error via improved `getReadableError` (already deployed) on every action
- **Commerce Hub:** unified vibrant cards, delivery zones tab already present — polish only
- **Media Hub:** spotlight slot editor for Find My Res sliders (reuse `AdminSlides` with new `slide_location = 'find_my_res_spotlight'`)
- **System Hub:** backend health card + edge function status (already present) restyled
- **Analytics:** add TUT / TVET / Private breakdown chart

## Technical Notes

- All colors via semantic tokens; zero hardcoded `bg-blue-*` / `text-white`
- New SQL packs are idempotent (guards + `IF NOT EXISTS`), grants included, RLS preserved
- No changes to `src/integrations/supabase/client.ts` or edge function URLs
- Component-scope only for redesign; no business-logic churn outside Phase 3 & 4 functional additions
- Backend abstraction respected — no direct client hardcoding beyond current pinned setup

## Deliverables

1. `src/components/findmyres/ResidenceSpotlightSlider.tsx` + wiring in `FindMyRes.tsx`
2. Vibrant token extensions in `index.css` + `tailwind.config.ts`
3. Redesigned `ResidencePropertyCard.tsx` and Find My Res chrome
4. `docs/DIVERSIFICATION_ADMIN_SQL.sql` (spotlight + audience + institution_type backfill)
5. Upgraded `AdminResidences.tsx`, `AdminApplications.tsx`, `AdminSlides.tsx` (spotlight location)
6. Admin dashboard vibrant pass across all hubs
7. `docs/ADMIN_DEEP_SCAN_REPORT.md` appended with findings + resolutions

## Out of Scope (this pass)

- Marketplace visual changes (on hold per prior direction)
- Auth flow, edge function contracts, RLS rewrites
