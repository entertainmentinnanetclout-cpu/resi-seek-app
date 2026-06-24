## Root cause (Part 1) — Preview vs Production drift

Preview and Production are the SAME Vercel/Lovable build and BOTH point at External Supabase `mefjzkhobkltlbmhusdh`. They are not diverging on the frontend.

The real drift is in the **database**:

```text
Frontend (preview + prod)   ──►  External Supabase  mefjzkhobkltlbmhusdh   (live data)
Edge functions (runtime)    ──►  External Supabase  mefjzkhobkltlbmhusdh   (via EXTERNAL_SUPABASE_* secrets)
supabase--migration tool    ──►  Lovable Cloud      vmqqkebojldjsyxcewdb   (config.toml project_id)  ◄── MISMATCH
```

Every migration we have run this week (Find My Res V3 columns, `filter_config`, `sync_queue`, `health_status`, RLS hardening, marketplace trigger, residences column REVOKE, slug trigger…) landed in the **Lovable Cloud mirror only**. External production is missing all of it. That is why:

- New code that reads `slug`, `category`, `is_tut_accredited`, `filter_config`, etc. works in our dev/preview reads when types match but returns null/empty on production data because columns/rows aren't there.
- Security hardening (column revokes, order seller trigger) is NOT live in production.
- `src/integrations/supabase/types.ts` was hand-edited to reflect Lovable Cloud schema, so TS compiles green even though External doesn't have those columns.

There is no Vercel/Lovable build mismatch to "redeploy" — there's a **schema delivery gap**. The fix is to ship one consolidated, idempotent SQL pack that the operator runs in External Supabase SQL Editor, then verify parity.

## Part 2 — Handover Pack data integrity

Current `download-handover-pack` edge function fetches `applications` then joins `profiles` by `user_id`. Risks:

- `profiles.full_name` is free-text — students with mismatched/empty names produce wrong rows.
- `applications` has its own `student_number` (sometimes), and `profiles.student_number` may differ.
- No funding source surfaced.
- No de-dup; multiple applications per student per residence appear as separate rows with no warning.
- Orphan applications (deleted profile) render as "N/A" instead of blocking export.

Fix: a single validated view + a validator function, both consumed by the existing edge function and a new Export Center tab. No new tables.

## Part 3 — Export Center (reuse existing AdminApplications hub)

Extend the **existing** Operations Hub → Applications tab with a "Handover Export" panel (no new route, no parallel module). Panel:

1. Calls `validate_handover_pack(residence_id)` RPC → shows counts (Total Students, Total Applications, Duplicates, Missing Names, Missing Student #, Missing Funding, Orphans, Invalid Residence).
2. If any error count > 0 → red "DATA INTEGRITY ERROR" card listing offending `application_id`s with deep links to AdminApplications. Export buttons disabled.
3. If clean → enables "Download CSV" and "Download PDF" (existing handover edge function, now reading from the validated view).

## Part 4 — Deliverables

### A. `docs/MASTER_EXPORT_INTEGRITY_SQL.sql` (rerunnable, idempotent)

Run in External Supabase SQL Editor. Contains:

- `ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS funding_source text;` (and any other missing handover columns)
- `CREATE OR REPLACE VIEW public.residence_handover_export_v` — security_invoker, joins `applications → profiles → residences`, exposes only: `application_id`, `ref_code`, `residence_id`, `residence_name`, `student_name`, `student_surname`, `student_number`, `funding_source`, `email`, `phone`, `status`, `applied_at`. Surname is split from `full_name` deterministically.
- `CREATE OR REPLACE FUNCTION public.validate_handover_pack(_residence_id uuid)` — returns jsonb `{ ok, totals: {...}, errors: [{code, application_id, reason}] }`. Checks: dup student_number per residence, dup applications (same user+residence), missing/blank name, missing surname, missing funding_source, missing student_number, application.residence_id not in residences, orphan profile.
- GRANTs: `SELECT` on view to `authenticated`, `EXECUTE` on function to `authenticated` (admin-gated inside function via `has_role`).
- No DROP, no destructive ops. Wrapped in `DO $$ ... $$` guards where needed.

### B. Catch-up migration pack `docs/EXTERNAL_PARITY_CATCHUP.sql`

Concatenation (re-export) of every Lovable-mirror-only change so the operator can bring External back to parity in one paste: Find My Res V3 columns + slug trigger + `filter_config` + RLS tightening + marketplace order trigger + residences contact column revoke. All `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP POLICY IF EXISTS ... CREATE POLICY ...`.

### C. Edge function update

`supabase/functions/download-handover-pack/index.ts`:

- Call `validate_handover_pack` first; if `ok=false` return 422 with the error list (no PDF/CSV).
- Read rows from `residence_handover_export_v` instead of ad-hoc joins.
- Keep `EXTERNAL_SUPABASE_*` env var pattern (unchanged).

### D. Frontend

- `src/pages/admin/AdminApplications.tsx` — add "Handover Export" section using the validator RPC (uses existing `supabase` client → External).
- No new route, no new admin page, no duplicate "Export" module.

### E. Reports

- `docs/DEPLOYMENT_AUDIT_REPORT.md` — documents the schema-delivery gap, lists the mismatched mirror migrations, gives the exact paste-order for External.
- `docs/HANDOVER_INTEGRITY_REPORT.md` — view/function spec, validation rules, integration checklist, QA checklist.

## What I will NOT do

- Will not create new tables, new admin routes, parallel export pages, or duplicate handover functions.
- Will not run destructive SQL.
- Will not touch `src/integrations/supabase/client.ts`, `types.ts`, or `supabase/config.toml`.
- Will not "redeploy production frontend" — there is nothing wrong with the frontend deploy; the gap is in the External DB.

## Open questions before I build

1. **Funding source field** — `applications` has no `funding_source` column on External today. Add it as nullable `text` (NSFAS / Self-Funded / Bursary / Other) and surface a small picker in the existing application form, or pull from a new `profiles.funding_source` instead? My recommendation: add to `applications` (per-application, students can change funder year to year).
2. **Surname split** — `profiles` only has `full_name`. Accept the simple rule "first token = name, rest = surname" for the view, or add explicit `first_name` / `last_name` columns to `profiles` and backfill? Recommendation: ship the split now (unblocks exports today), add explicit columns in a follow-up.
3. **Who runs the catch-up SQL?** I can produce `EXTERNAL_PARITY_CATCHUP.sql` ready to paste, but only the project owner can execute it in the External SQL Editor. Confirm you'll run it — otherwise nothing actually lands in production.

Produce a complete EXTERNAL_PARITY_CATCHUP.sql file that is fully rerunnable and idempotent using IF NOT EXISTS, DO $$ blocks, CREATE OR REPLACE FUNCTION, DROP POLICY IF EXISTS, and CREATE POLICY patterns. The SQL must bring External Supabase to the exact same schema state as the currently running backend. Include:

- Tables
- Views
- Functions
- Triggers
- RLS Policies
- Storage Buckets
- Role Grants
- Foreign Keys
- Indexes
- Constraints
- Enums
- Health Dashboard tables
- Accreditation tables
- Commerce Hub tables
- Operations Hub tables
- Media Hub tables
- Application/Handover Pack fixes
- Funding Source additions
- First Name / Last Name additions

Output as one master SQL pack with section headers and verification queries at the end.

&nbsp;

Do not assume the filter_config schema. Inspect the existing table structure before generating migration SQL. If filter_config already exists, use the existing required columns and perform UPSERTs rather than INSERTs. All migration SQL must be schema-aware and rerunnable.