# Handover Pack Integrity — Implementation Report

## Single source of truth

- View: `public.residence_handover_export_v` (security_invoker)
- Function: `public.validate_handover_pack(_residence_id uuid DEFAULT NULL)` (admin-only)
- SQL pack: `docs/MASTER_EXPORT_INTEGRITY_SQL.sql`
- Catch-up pack: `docs/EXTERNAL_PARITY_CATCHUP.sql` (Section 07)

No new tables, no new admin route, no parallel export module. The existing
`download-handover-pack` edge function and the Operations Hub → Applications
tab now consume the validated view exclusively.

## Validation rules

| Code | Rule |
|---|---|
| `missing_name` | `profiles.full_name` blank → no first token |
| `missing_surname` | `profiles.full_name` has no space → no surname |
| `missing_student_number` | `profiles.student_number` blank |
| `missing_funding` | `applications.funding_type` blank or `'unknown'` |
| `invalid_residence` | `applications.residence_id` does not exist in `residences` |
| `orphan_profile` | `applications.user_id` has no row in `profiles` |
| `duplicate_student_number` | Same student number on two applications to the same residence |
| `duplicate_application` | Same user has multiple applications to the same residence |

If any error rows are returned, `ok = false` and the edge function returns
HTTP 422 with the full error list. CSV and PDF buttons in the admin panel are
disabled until validation passes.

## Frontend integration checklist

- [x] `src/components/admin/HandoverExportPanel.tsx` — pre-flight panel
- [x] `src/pages/admin/AdminApplications.tsx` renders the panel at the top
- [x] Existing inline "Export Handover Pack" button retained for backwards-compat (data path unchanged); new validated CSV path is preferred
- [x] Validated CSV downloads from the view, not raw joins

## Edge function changes

`supabase/functions/download-handover-pack/index.ts`:

- Calls `validate_handover_pack` first.
- On `ok=false` → HTTP 422 with the integrity payload (no PDF/CSV emitted).
- Reads rows from `residence_handover_export_v` instead of ad-hoc joins.
- `EXTERNAL_SUPABASE_*` env vars unchanged.
- Optional body flag `skip_validation: true` for emergencies only.

## Production verification checklist

After running `EXTERNAL_PARITY_CATCHUP.sql` on External:

1. `SELECT COUNT(*) FROM public.residence_handover_export_v;` returns the count of applications.
2. `SELECT public.validate_handover_pack(NULL);` returns a jsonb with `ok` and `totals`.
3. In Admin → Applications, "Run Pre-Export Validation" returns a counts grid.
4. If errors are listed, clicking each `application_id` opens the offending record.
5. With clean data, "Download CSV (Validated Only)" produces a file whose rows match the view.

## QA checklist

- [ ] Applicant with blank `full_name` → blocked with `missing_name`
- [ ] Applicant with single-word `full_name` → blocked with `missing_surname`
- [ ] Two applicants share the same student number on one residence → blocked with `duplicate_student_number`
- [ ] Same user applies twice to one residence → blocked with `duplicate_application`
- [ ] Delete a residence referenced by an application → blocked with `invalid_residence`
- [ ] `funding_type='unknown'` → blocked with `missing_funding`
- [ ] Non-admin user calls `validate_handover_pack` → 42501 error
- [ ] Anonymous user calls validator → 28000 error