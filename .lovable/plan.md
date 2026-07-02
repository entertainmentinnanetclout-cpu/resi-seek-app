# ResKonnect — Audience Diversification, Applications Hub & Marketplace Pause

Master plan. Structured so any agent (or you) can execute phase-by-phase without drift. Every phase ends with a checkpoint you can verify in the UI + a matching SQL block in one master file: `docs/AUDIENCE_V1_MASTER_SQL.sql` (External Supabase).

---

## Phase 0 — Ground Rules (read once, keep applying)

- **Backend of truth:** External Supabase (via BAL `provider=supabase`). Every schema change ships in `docs/AUDIENCE_V1_MASTER_SQL.sql` — one rerunnable file, idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, etc.).
- **UI ↔ DB parity check:** at the end of each phase, run `supabase--read_query` counts to confirm the frontend numbers match DB reality. Log results in `docs/AUDIENCE_V1_PARITY_REPORT.md`.
- **No new duplicate pages.** Extend existing ones (`FindMyRes`, `Landing`, `AdminResidences`, `hero_slides`).
- **South African English + ZAR** everywhere.

---

## Phase 1 — Audience Model (DB + Admin)

### Goal

Every residence can be tagged with any combination of audiences it accepts. Admin controls it from one place.

### DB changes (in master SQL)

```sql
-- 1. audience columns on residences
ALTER TABLE public.residences
  ADD COLUMN IF NOT EXISTS accepts_university boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_tvet       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_private    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_nsfas      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS institution_tags   text[] NOT NULL DEFAULT '{}'; -- e.g. {TUT, Tshwane North College, UNISA}

CREATE INDEX IF NOT EXISTS idx_residences_audience
  ON public.residences (accepts_university, accepts_tvet, accepts_private, accepts_nsfas);
```

### Admin UI

- `AdminResidences` edit dialog: new "Audience & Accreditation" section with 4 switches + a chip-input for `institution_tags`.
- Backfill helper button: "Mark all as University + NSFAS" (safe default for existing rows).

### Checkpoint

Row count in DB with `accepts_tvet=true` = count shown in admin filter chip.

---

## Phase 2 — Audience Selector (Public UX)

### Goal

Single, prominent segmented control at the top of `Landing` and `FindMyRes`. Big buttons, accessible, animated, **click-to-open / click-again-to-close** dropdown of institution sub-filters.

### Component

`src/components/findmyres/AudienceSelector.tsx`

- 3 primary pills: **University**, **TVET / College**, **Private**.
- Each pill = toggle (press again = deselect → shows all).
- Below each active pill, a collapsible chip row of `institution_tags` (TUT, UNISA, Tshwane North College, Tshwane South College, etc.) driven by `filter_config` table.
- State stored in URL (`?audience=tvet&institution=Tshwane+North+College`) so links are shareable.
- Feeds `useResidenceFilters` via three new filter keys: `audience`, `institutionTag`.

### Filter logic

```ts
// useResidenceFilters
if (filters.audience === 'university') filtered = filtered.filter(r => r.accepts_university);
if (filters.audience === 'tvet')       filtered = filtered.filter(r => r.accepts_tvet);
if (filters.audience === 'private')    filtered = filtered.filter(r => r.accepts_private);
if (filters.institutionTag)            filtered = filtered.filter(r => r.institution_tags?.includes(filters.institutionTag));
```

### Landing page

Replace the current TUT-only hero copy with a 3-card "Who are you?" block above the fold; each card deep-links into `/find?audience=…`. Keeps existing hero slider below.

### Checkpoint

- Toggle behavior: press once = open+filter, press again = close+clear.
- Only one audience active at a time (radio-like), but institution chips are multi-select.

---

## Phase 3 — Marketplace on Hold

### Goal

Hide marketplace from public nav; keep data + admin management intact.

### Changes

- Remove marketplace links from: `PublicLayout` header, `Landing` sections, mobile bottom nav, `CommandPalette`.
- New page `src/pages/MarketplaceComingSoon.tsx` (branded, "Back in early 2026, focus on accommodation first" + waitlist email capture → `platform_settings.waitlist_marketplace`).
- Route `/marketplace` + `/marketplace/*` (product/store/cart/checkout) → render ComingSoon (keep old routes intact so old links don't 404).
- Admin routes and `CommerceDashboard` remain fully functional (behind auth).
- Add feature flag row in `platform_settings`: `{ key: 'marketplace_public_enabled', value: {enabled:false} }` so we can re-enable with one toggle.

### Checkpoint

Anonymous visit to `/marketplace` shows Coming Soon; admin at `/admin/commerce` still works.

---

## Phase 4 — Applications Helper Hub (Phase-1 scope: info + checklist)

### Goal

One page that tells students exactly which docs to prepare for TUT, NSFAS (TVET + University), and lets them upload to us so we hold the pack.

### Route & files

- `/apply` → `src/pages/ApplicationsHub.tsx`
- Sub-tabs: **TUT**, **NSFAS (University)**, **NSFAS (TVET)**, **Private College** (add UNISA later).
- Each tab shows:
  - Deadline banner (pulled from `platform_settings.application_deadlines`).
  - Required-docs checklist with checkbox state stored in `application_prep` table.
  - External "Apply on official site" button.
  - "Upload to ResKonnect" panel reusing `DocumentUploader` → saves to existing `documents` bucket, tagged `purpose='application_pack'`.

### DB

```sql
CREATE TABLE IF NOT EXISTS public.application_prep (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution text NOT NULL,          -- 'TUT' | 'NSFAS_UNI' | 'NSFAS_TVET' | 'PRIVATE'
  checklist jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, institution)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_prep TO authenticated;
GRANT ALL ON public.application_prep TO service_role;
ALTER TABLE public.application_prep ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prep" ON public.application_prep FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### Checkpoint

Student can check off items, refresh page, state persists. Admin can view aggregated readiness in a small `AdminApplicationsPrep` widget added to Operations Hub.

---

## Phase 5 — Deadline Slides (seeded from research)

Insert into `hero_slides` (`slide_location='main'`, active) via `supabase--insert`:


| Title                              | Copy                                            | CTA                      | Deadline                                   |
| ---------------------------------- | ----------------------------------------------- | ------------------------ | ------------------------------------------ |
| NSFAS TVET 2026 — Trimester 3 open | Apply now for TVET funding                      | `/apply?tab=nsfas-tvet`  | rolling                                    |
| TUT 2026 late applications         | Selected programmes still open — apply today    | `/apply?tab=tut`         | 30 Sep 2025 (verified from TUT prospectus) |
| NSFAS University 2026              | Applications for 2026 university funding        | `/apply?tab=nsfas-uni`   | check NSFAS site                           |
| Private colleges                   | Boston, Damelin, Rosebank — accommodation ready | `/find?audience=private` | rolling                                    |


Store the copy dates in `platform_settings.application_deadlines` so admin edits update slides + `ApplicationsHub` in one place.

---

## Phase 6 — DB ↔ UI Verification & Cleanup

- Run `supabase--linter` after applying master SQL; fix any advisories.
- Add `docs/AUDIENCE_V1_PARITY_REPORT.md` with:
  - residences count per audience
  - marketplace listings hidden vs visible
  - application_prep row count
- Confirm BAL still points to External Supabase.
- Remove any code paths that still reference the marketplace from public discovery.

---

## Deliverables


| File                                                                                                                                                                                                                                | Purpose                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `docs/AUDIENCE_V1_MASTER_SQL.sql`                                                                                                                                                                                                   | Single idempotent SQL pack (Phases 1, 3 flag, 4, 5 seed) |
| `docs/AUDIENCE_V1_PARITY_REPORT.md`                                                                                                                                                                                                 | Post-run DB/UI parity numbers                            |
| `src/components/findmyres/AudienceSelector.tsx`                                                                                                                                                                                     | New segmented control                                    |
| `src/pages/ApplicationsHub.tsx`                                                                                                                                                                                                     | New apply page                                           |
| `src/pages/MarketplaceComingSoon.tsx`                                                                                                                                                                                               | Coming-soon replacement                                  |
| Updated: `Landing.tsx`, `FindMyRes.tsx`, `useResidenceFilters.ts`, `PublicLayout.tsx`, `AdminResidences.tsx`, `App.tsx` routes**THE LOVABLE PREVIEW MUST FULLY MATCH THE EXTERNAL DEPLOYED SITE ON VERCEL UNDER ResKonnect.co.za** | &nbsp;                                                   |


## Out of scope (park for later phases)

- Direct TUT/NSFAS API submission
- UNISA / private college onboarding wizard
- Marketplace re-launch
- Roommate matching against new audience tags (Phase 2 later)

Once you approve, I'll implement Phase 1 → 6 in that order in build mode and stop after Phase 6 for your verification.