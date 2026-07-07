# Admin Deep Scan — TVET / Private / Application Workflow

Date: 2026-07-07
Trigger: user request to verify every admin surface supports TVET and Private residences alongside TUT / University, and that the full application workflow is end-to-end.

## SQL fix shipped

`docs/REFERRAL_V2_SQL.sql` — `sync_residence_audience_tags()` used `text[] || 'literal'`, which Postgres tries to parse as an array literal (`malformed array literal: "university"`). Switched to `array_append(_tags, 'university')` on all three lines. The pack is now safe to re-run.

## Coverage matrix

| Surface | University | TVET | Private | Application-flow | Status |
|---|---|---|---|---|---|
| `AdminResidences` — filter tabs | ✓ | ✓ | ✓ | n/a | Complete |
| `AdminResidences` — row audience chips (click to toggle) | ✓ | ✓ | ✓ | n/a | Complete |
| `AdminResidences` — edit dialog Audience & Accreditation block | ✓ | ✓ | ✓ | n/a | Complete |
| `BulkAudienceActions` (add/remove/set) | ✓ | ✓ | ✓ | n/a | Complete |
| `AdminApplications` — institution filter | ✓ | ✓ | ✓ | ✓ | Complete |
| `AdminApplications` — status pipeline | n/a | n/a | n/a | ✓ | Complete (uses `update-application-status` edge fn) |
| `AdminResidencePortals` | inherits from residence audience | ✓ | ✓ | ✓ | Complete |
| `AdminLandlordApplications` | ✓ | ✓ (institution_tags on approval) | ✓ | ✓ | Complete |
| `AdminFollowUp` | ✓ | via institution_type on application | via institution_type | ✓ | Complete |
| `AdminRecruitmentProgramme` | ✓ | ✓ | ✓ | ✓ | Complete |
| Find My Res — `AudienceSelector` | ✓ | ✓ | ✓ | n/a | Complete |
| Find My Res — `useResidenceFilters` audience branches | ✓ | ✓ | ✓ | n/a | Complete |
| Find My Res — `ResidencePropertyCard` audience chips | ✓ | ✓ | ✓ | n/a | Complete (NSFAS, TUT, TVET, Private badges rendered) |
| Campus catalog (`src/lib/campuses.ts`) | ✓ | ✓ (added) | ✓ (added) | n/a | Complete |
| Handover export | ✓ | ✓ (audience-agnostic) | ✓ (audience-agnostic) | ✓ | Complete |

## Data model summary

`public.residences` audience columns (from REFERRAL_V2_SQL + DIVERSIFICATION packs):

- `accepts_university boolean default true`
- `accepts_tvet boolean default false`
- `accepts_private boolean default false`
- `accepts_nsfas boolean default false`
- `institution_tags text[]` — free-form tags used by chip filter
- `audience_tags text[]` — auto-synced by `sync_residence_audience_tags()` trigger; keeps `accepts_*` and array representation aligned for GIN index queries
- `is_spotlight boolean`, `spotlight_rank int`

`public.applications`:

- `institution_type text` — one of `university | tvet | private | other`, validated by `validate_application_institution_type()` trigger
- `idx_applications_institution_type` covers filter queries

## Application workflow — end-to-end walkthrough

1. Student opens Find My Res, picks an audience (University / TVET / Private), the residence list filters via `useResidenceFilters` `audience` branch.
2. Student clicks Apply on a card. `ResidenceDetail` writes into `applications` with `institution_type` derived from the residence's primary audience.
3. If the student arrived via `/r/:code`, `application_referrals` links the application to the referring recruiter via `referral_sessions`.
4. Admin sees the application in `AdminApplications`, filters by institution type, and moves it through statuses. Status changes hit the `update-application-status` edge function.
5. On approval, the residence portal owner sees the application in `ResidenceInbox` scoped by `residence_portal_accounts` + `is_authorized_residence_user()`.
6. Handover pack export includes audience-tagged rows regardless of institution.
7. Recruiter attribution rolls up in `AdminRecruitmentProgramme` and `RecruiterDashboard`.

## What changed in this pass

- Fixed `sync_residence_audience_tags()` array append bug.
- Extended `src/lib/campuses.ts` with `TVET_CAMPUSES`, `PRIVATE_LOCATIONS`, `CAMPUSES_BY_AUDIENCE`, and `ALL_CAMPUSES` so any future admin/public picker can render an audience-aware campus list.
- Documented the coverage matrix so future scans start from a known baseline.

## What did NOT need code changes

All admin dashboards already carry TVET/Private-aware filters, chips, and bulk actions. The Find My Res card and filter stack already renders and filters by all three audiences. Applications table already carries `institution_type`. No new SQL migrations required beyond the one-line trigger fix in the referral pack.

## Re-run instructions

1. On External Supabase, re-run `docs/REFERRAL_V2_SQL.sql` (idempotent). The array-append bug is fixed.
2. Verify with:

   ```sql
   SELECT id, name, accepts_university, accepts_tvet, accepts_private, audience_tags
   FROM public.residences LIMIT 5;
   ```

   `audience_tags` should reflect the boolean columns after any insert/update.