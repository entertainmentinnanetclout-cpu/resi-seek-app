## Scope

Four connected items:

1. **Fix the SQL error** in `docs/REFERRAL_V2_SQL.sql` blocking the referral pack from running.
2. **Redesign the Find My Res accommodation list** — new card + list structure with the vibrant palette from `index.css`.
3. **TVET / Private parity** — admin per-residence audience control, Find My Res filters, and campus/institution catalogs so TVET and Private are first-class alongside TUT/University.
4. **Admin dashboard UI upgrade + deep scan** — modernize applications/residences tables, modals and nav to match the newer public UI, then audit every admin function for TVET/Private + full application workflow coverage.

---

## 1. SQL fix (root cause of the crash)

`sync_residence_audience_tags()` does `_tags := _tags || 'university'`. In Postgres, `text[] || text` needs the right side to be an array literal or a matching element expression that resolves as `text[]`. The planner is trying to parse `'university'` as an array literal → *malformed array literal*.

Replace the three lines with either:

```sql
_tags := array_append(_tags, 'university');
```

or

```sql
_tags := _tags || ARRAY['university']::text[];
```

Also verify the backfill line (`UPDATE ... SET accepts_university = accepts_university`) actually fires the trigger — it will, because it's an UPDATE OF listed column. Keep it.

Ship as a small patch to `docs/REFERRAL_V2_SQL.sql` (idempotent — `CREATE OR REPLACE FUNCTION`, safe to re-run).

---

## 2. Find My Res list redesign

Files: `src/pages/FindMyRes.tsx`, `src/components/findmyres/ResidencePropertyCard.tsx`, `src/components/ResidenceSectionGrid.tsx`.

Changes:
- New card layout: larger image with gradient overlay, price pill top-right, audience chips (Uni / TVET / Private) bottom-left, trust + verification badges on the image, campus + distance row, amenity icon strip, dual CTA (View · Apply).
- Use existing semantic tokens (`sky`, `amber`, `violet`, `primary`, `accent`) — no hardcoded colors. Each audience gets its own accent color already defined in the AudienceSelector.
- List container: switch section headers to colored gradient bands (per-section accent), keep the collapsible pattern, add a compact toggle (grid ↔ list rows) for dense browsing.
- Spotlight slider stays at top; cards inside it inherit the new design.
- No business-logic changes — same data hook, same routes.

---

## 3. TVET / Private full inclusion

**Database (extend REFERRAL_V2_SQL, no new pack):**
- `residences.accepts_tvet`, `accepts_private` already added — keep.
- Confirm `institution_tags text[]` (from DIVERSIFICATION pack) is present; if not, add.
- Add `campus_type text` on `residences` with values `university | tvet | private | mixed`, defaulting from booleans via the same trigger.

**Campus catalog (`src/lib/campuses.ts`):**
- Add `TVET_CAMPUSES` (Tshwane North, Tshwane South, Ekurhuleni West, Boston, Damelin, Rosebank) and `PRIVATE_LOCATIONS` (working professional hubs — Pretoria CBD, Hatfield, Centurion, Menlyn).
- Export a unified `ALL_CAMPUSES` grouped by audience for pickers.

**Admin per-residence control (`src/pages/admin/AdminResidences.tsx` + edit dialog):**
- Row-level "Audience" cell showing colored chips.
- Edit modal: three toggles (University / TVET / Private) plus institution-tag multi-select bound to the audience.
- Keep the existing `BulkAudienceActions` toolbar.

**Find My Res filters (`src/pages/FindMyRes.tsx`, `AudienceSelector`, `FilterSidebar`, `FilterBottomSheet`):**
- Audience selector already exists — wire the TVET and Private branches to filter on `accepts_tvet` / `accepts_private` (currently university-biased query).
- Campus dropdown becomes audience-aware: when TVET is active, show TVET colleges; when Private is active, show private locations.
- Institution chip filter uses `institution_tags @>` for TVET, city/suburb for Private.

**Application form:** ensure `institution_type` is captured (already added to `applications` table); default from the residence's primary audience.

---

## 4. Admin dashboard UI upgrade + deep scan

**UI parity pass (presentation only, no logic changes):**
- `AdminApplications.tsx`: adopt the new card/table style used on Find My Res — sticky header, status pills using semantic colors, audience chip column, quick-action row (approve / message / view docs), redesigned detail modal with tabs (Applicant · Documents · Activity · Referral attribution).
- `AdminResidences.tsx`: same treatment — audience chips, spotlight star toggle inline, bulk toolbar already there.
- `AdminOperationsHub.tsx`: modern tab bar (pill tabs, subtle accent underline), consistent page header, breadcrumbs.
- Shared modal shell for admin dialogs (glass background, gradient header per hub).

**Deep-scan report → `docs/ADMIN_TVET_PRIVATE_SCAN.md`:**
Enumerate every admin surface and mark TVET / Private support state:

```text
Surface                            | TVET | Private | Application-flow | Gap
-----------------------------------|------|---------|-------------------|-----
AdminResidences (edit + bulk)      |  ✓  |   ✓    |        n/a       | none
AdminApplications                  |  ?  |   ?    |   institution?   | filter chips
AdminResidencePortals              |  ?  |   ?    |        ✓        | tag column
AdminFollowUp                      |  ?  |   ?    |        ✓        | audience filter
AdminLandlordApplications          |  ?  |   ?    |        ✓        | audience field
AdminOperationsHub tabs            |  ?  |   ?    |        ✓        | pill styling
AdminRecruitmentProgramme          |  ✓  |   ✓    |        ✓        | none
Handover export / bookings         |  ?  |   ?    |        ?        | verify col
```

Fill the `?` cells during the scan and fix each gap in the same pass — filter chips on lists, audience columns on tables, institution routing on application status updates, and edge-function payload updates where required.

---

## Deliverables

- Patched `docs/REFERRAL_V2_SQL.sql` (single line-set change in the trigger function).
- New/edited components listed in section 2 and 3.
- Updated admin pages listed in section 4.
- `docs/ADMIN_TVET_PRIVATE_SCAN.md` — the deep-scan report with the fixes applied.
- No new SQL pack unless the scan surfaces a missing column; if so, appended as a small addendum block to `REFERRAL_V2_SQL.sql` so the user still runs one file.

## Out of scope

- Recruiter/Referral V2 already shipped — no changes there beyond the SQL fix.
- No changes to auth, storage, or edge-function contracts unless the scan flags a hard blocker.
