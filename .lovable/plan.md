## Part A — Revert to External Supabase (keep safety net)

**Repoint, don't rebuild.** External Supabase becomes the active provider again; Lovable Cloud stays wired as a hot standby.

1. **Switch active driver** in `src/backend/index.ts` default to `"supabase"`; set `VITE_BACKEND_PROVIDER=supabase` in `.env`. `src/integrations/supabase/client.ts` already points at External (`mefjzkhobkltlbmhusdh`) — leave untouched.
2. **Edge functions** — keep the dual-env fallback logic added during cutover, but document External as primary. No redeploy needed (auto).
3. **Keep**: `src/backend/` BAL, `src/pages/admin/AdminBackendHealth.tsx`, `sync_queue` + `health_status` tables, `docs/PHASE_1A_SQL_PACK.sql` as DR pack.
4. **Health dashboard** — flip labels: External 🟢 primary, Lovable Cloud 🟢 standby. Surface "active provider" pill.
5. **No data migration needed** — historical data already lives on External; Lovable Cloud writes from the outage window stay in `sync_queue` for later one-way replay (Phase 1D, not in this plan).

## Part B — Find My Res V3.0 (Property24-tier upgrade)

### Audit & reuse (no duplicates)
Existing assets to extend, not replace:
- `src/pages/FindMyRes.tsx` — main page
- `src/hooks/useResidenceFilters.ts` — filter state + match scoring (extend, don't fork)
- `src/hooks/useResidenceSections.ts` + `residence_sections` table — already drives category sections
- `src/components/findmyres/{SmartSearchBar,FilterSidebar,FilterBottomSheet,ActiveFilterChips,ResidencePropertyCard}.tsx`
- `src/components/admin/SectionsManager.tsx` — already manages sections (extend for categories + filter config)
- `residences` table (27 cols) — add only missing fields
- `filter_config` table (per memory) — reuse for filter management

### UI architecture (FindMyRes page)

```text
┌─────────────────────────────────────────────────┐
│ Sticky Top Filter Bar (Property24-style)        │
│ Location · Campus · Category · Price · Gender · │
│ NSFAS · TUT · Singles · Available · Furnished · │
│ WiFi · Parking · Distance   [More ▾]            │
├─────────────────────────────────────────────────┤
│ § 1  FLATS                 → View All Flats     │
│ ◀ [card] [card] [card] [card] [card] ▶          │
├─────────────────────────────────────────────────┤
│ § 2  COMMUNES              → View All           │
│ ◀ [card] [card] [card] ▶                        │
├─────────────────────────────────────────────────┤
│ § 3  STUDENT RESIDENCES    → View All           │
├─────────────────────────────────────────────────┤
│ § 4  PRIVATE RENTALS       → View All           │
├─────────────────────────────────────────────────┤
│ § 5  FEATURED (AI-ranked)                       │
├─────────────────────────────────────────────────┤
│ LANDLORD CTA — "List Your Property" →           │
│   /landlord-accreditation                       │
└─────────────────────────────────────────────────┘
```

Deep-link support: `/find-my-res?category=flats|communes|residences|rentals` pre-applies category filter and scrolls to that section.

### New components (additive)
- `CategoryRail.tsx` — horizontal scroll wrapper with snap + arrows, used by all 5 sections
- `CategoryHeroSelector.tsx` — landing-page visual category picker (4 cards → deep links)
- `AccreditationCTA.tsx` — "Become Accredited 2026–2031" landlord block
- `StatusBadge.tsx` — FULL (pulsing red) / LIMITED (orange) / AVAILABLE (green) / NEW (blue) / FEATURED (gold)

### Card upgrade (`ResidencePropertyCard.tsx` — extend in place)
Add: status badges, "Singles Available" pill (already partially present — make prominent), gender pill, accreditation badges (NSFAS/TUT), distance, beds available number. No new card file.

### Landing page additions (`src/pages/Landing.tsx`)
- "Find Your Next Home" section using `CategoryHeroSelector`
- "Become Accredited" section using `AccreditationCTA`

### Admin upgrades (extend `AdminOperationsHub` / accommodation tabs)
- **Residence Categories** tab — reuse `SectionsManager` pattern, add `category` field
- **Filter Management** tab — new `FilterConfigManager.tsx` over `filter_config` table (ordering, visibility, labels, featured, groups)
- **Availability Control** dashboard widget — total beds, full, singles
- **Accreditation Pipeline** — already exists as `AdminLandlordApplications`; add status counters widget
- **Hub Analytics** — extend `AdminAnalytics` cards (Total Properties, Available Beds, Full, Singles, Apps Today/Month, Accreditation Apps, Conversion)

### SEO
- Slug column on residences → routes `/find-my-res/:slug` (keep `/res/:id` working via redirect)
- `SEOJsonLd.tsx` extended with `Residence` / `Apartment` / `RentalProperty` schema types
- Sitemap regen includes slug routes

### Performance
- React Query for residence fetch (already used); add `staleTime: 60s`
- `loading="lazy"` on all card images (already present)
- Virtualized horizontal rails via CSS scroll-snap (no lib)
- Indexed columns: `category`, `gender`, `is_nsfas_accredited`, `is_tut_accredited`, `available_spots`, `singles_available`, `slug`

### Database changes (External Supabase, re-runnable)
Audit first via `supabase--read_query`. Likely missing on `residences`:
- `category` text (`flats|communes|student_residence|private_rental`) — default inferred from existing data
- `gender` text (`male|female|mixed`)
- `singles_available` int
- `is_tut_accredited` bool
- `is_furnished`, `has_wifi`, `has_parking` bool (may exist in `amenities[]` — keep as-is and derive)
- `lease_period`, `deposit_amount`, `utilities_included` (for rentals)
- `slug` text unique
- `is_featured` bool, `featured_rank` int
- `view_count`, `application_count` int (for AI ranking)

New table:
- `filter_config(id, key, label, group, display_order, is_visible, is_featured, is_multiselect, options jsonb)` — admin-managed
- GRANT SELECT to anon+authenticated; ALL to service_role; admin-only write policy via `has_role(auth.uid(),'admin')`

Indexes on every filterable column. Triggers: `update_updated_at`, slug auto-gen from name+id.

### Deliverables bundle
- `docs/FIND_MY_RES_V3_SQL.sql` — rerunnable master pack (additive ALTERs guarded with `IF NOT EXISTS`, new tables, RLS, GRANTs, indexes, triggers, seed for `filter_config`, rollback section)
- Migration file via `supabase--migration` tool (External Supabase target)
- Updated `KNOWLEDGE_BASE.md` + memory entries (FindMyRes V3 architecture, filter_config system, category model)
- `docs/FIND_MY_RES_V3_REPORT.md` — reuse report, new assets, DB diff, routes, QA + mobile + perf checklists

### Out of scope (confirm before adding)
- Map view / clustering
- Saved searches + alerts
- Compare drawer extension (already exists; not touching)
- Phase 1D External↔Lovable sync replay

---

**Confirm to proceed.** Two flags before I build:

1. **Category source** — derive `category` from existing `room_type`/`section_category` heuristically on migration, or leave NULL and let admin tag manually? (Recommend: heuristic + admin override.)
2. **Slug routing** — add `/find-my-res/:slug` as primary and 301 `/res/:id` → slug, or keep both equal? (Recommend: slug primary, id redirects.)
