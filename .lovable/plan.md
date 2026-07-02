# Admin Deep Scan & Master Fix

Goal: every admin page loads, every action works, every edge function returns 200 on the External Supabase project. No stub pages, no silent RPC failures, no missing tables.

## Phase 0 — Full Deep Scan (no code left unturned)

Produce `docs/ADMIN_DEEP_SCAN_REPORT.md` covering:

1. Every file under `src/pages/admin/**` and `src/components/admin/**` — for each: tables/RPCs/functions/buckets it touches, plus PASS/FAIL against External DB.
2. Every edge function in `supabase/functions/**` — env vars required, deployment status, invocation path from UI, PASS/FAIL smoke test.
3. Every `.from(...)`, `.rpc(...)`, `.storage.from(...)`, `functions.invoke(...)` call across `src/**` cross-referenced with the live External schema (`supabase--read_query` on `information_schema`).
4. Every route in `src/App.tsx` — guard, layout, existence of target component.
5. `docs/UI_DB_TOUCHPOINT_MATRIX.md` refreshed with a Missing / Broken / OK column.

Deliverable: a single markdown table of every failure with root cause + fix owner (SQL vs code vs edge fn).

## Phase 1 — Admin UI Fixes

Focus areas the user called out plus everything the scan flags. Expected concrete fixes based on quick sweep:

- **AdminResidences**: image-upload bucket path bug (uses `admin-images` for both upload + public URL — verify storage policy, empty-state when `residences` returns 0, add error surface).
- **AdminResidencePortals**: replace silent `supabase.functions.invoke` failures with typed error toast + retry; ensure it reads the External URL via `externalFunctionUrl('create-residence-portal-user')` with explicit anon key + Authorization headers (same pattern already used elsewhere).
- **Messages page** (student + admin variant): currently a stub — wire to `application_messages` with realtime, PII-safe.
- **AdminApplications / AdminFollowUp / AdminDocuments / AdminUsers / AdminLandlordApplications**: add loading + error + empty states; verify FK joins use explicit constraint names.
- **AdminMediaHub / AdminCommerceHub / AdminSystemHub** tab modules: audit each embedded `*Content` export.
- **AdminBackendHealth**: ping every edge function + every critical table, show red/green.

All fixes stay inside existing hubs — no new admin pages, no duplicate routes.

## Phase 2 — Edge Function Hardening

For each of the 12 functions:
- Confirm `EXTERNAL_SUPABASE_URL`, `EXTERNAL_SUPABASE_ANON_KEY`, `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` are read (not the Lovable defaults).
- Uniform CORS headers, uniform error envelope `{ error, _version }`.
- Auth: `getUser()` via user client, `has_role` via admin client (fix any that skip this).
- Add `_health` GET branch so AdminBackendHealth can probe without side-effects.

## Phase 3 — MASTER_GOD_SQL v5 (single rerunnable pack)

Replaces `docs/MASTER_GOD_SQL.sql`. Idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, safe `ALTER`s). Sections:

1. Missing tables / columns discovered in scan (extends current pack).
2. Every `public` table: verify + reapply `GRANT`s for `authenticated` and `service_role`; `anon SELECT` only where policy allows.
3. RLS policy audit: reapply admin-full-access via `has_role(auth.uid(),'admin')` on every admin-managed table.
4. Storage policies for `admin-images`, `payment-proofs`, `application-documents`, `wil-documents`, `landlord-documents` (admin RW, owner RW where relevant).
5. `residence_portal_accounts` unique index on `(residence_id)` + `(email)` so create-portal fails cleanly.
6. Missing RPCs referenced by UI: `has_role`, `get_user_staff_role`, `is_authorized_residence_user`, `capture_referral`, `capture_referral_sale`, `validate_handover_pack`, `get_or_create_referral_code` — recreate if drift.
7. Realtime `ALTER PUBLICATION` for `application_messages`, `notifications`, `shop_orders`, `marketplace_orders` (wrapped in `DO $$ ... EXCEPTION`).
8. Verification block: 8 `SELECT` statements at the bottom that print row counts + missing-object list — user runs and pastes back if anything is red.

## Phase 4 — Verification

- Run `supabase--read_query` against External to confirm every table+RPC exists after user runs the pack.
- Playwright pass through all 6 admin hub tabs, screenshot each, attach to report.
- AdminBackendHealth must be all-green.

## Files touched (planned)

Code:
- `src/pages/Messages.tsx` (wire to real data)
- `src/pages/admin/AdminResidences.tsx`, `AdminResidencePortals.tsx`, `AdminApplications.tsx`, `AdminFollowUp.tsx`, `AdminDocuments.tsx`, `AdminUsers.tsx`, `AdminLandlordApplications.tsx`, `AdminBackendHealth.tsx` (error/empty states, health probes)
- Any hub `*Content` module the scan flags
- All 12 files under `supabase/functions/*/index.ts` (uniform env + health branch)

Docs / SQL:
- `docs/ADMIN_DEEP_SCAN_REPORT.md` (new)
- `docs/UI_DB_TOUCHPOINT_MATRIX.md` (updated)
- `docs/MASTER_GOD_SQL.sql` (v5, rerunnable — the single SQL to run on External)

## Out of scope
No changes to public/student pages beyond `Messages.tsx`. No new admin routes. No provider swap.
