# Admin Deep Scan Report — v5

> Generated after emergency admin audit. Every failure in the admin console
> resolved to one of three buckets: SQL (schema/FK/policy), Edge Function
> (invocation URL), Frontend (embed hints or stub pages).

## Root-cause matrix

| # | Symptom | Owner | Fix |
|---|---------|-------|-----|
| 1 | AdminResidencePortals load fails / "more than one relationship" | SQL | Drop duplicate FK `residence_portal_accounts_residence_id_fkey` (see MASTER_GOD_SQL v5 § 05). |
| 2 | Portal creation returns Edge Function error | Frontend | `supabase.functions.invoke` hits External URL where functions do not exist. Replaced with `invokeEdgeFunction` helper that targets Lovable Cloud functions gateway while forwarding External JWT. |
| 3 | Booking-slip download fails | Frontend | Same as #2, now uses `invokeEdgeFunction('generate-booking-slip', …, { rawText: true })`. |
| 4 | Update-application-status fails on residence portal | Frontend | Same as #2. |
| 5 | Messages page permanently empty | Frontend | Was a stub; wired to `application_messages` with realtime subscription. |
| 6 | AdminResidences shows 0 listings | SQL/Frontend | Confirm listing counts via verification block; grant + policy audited. |
| 7 | Missing tables referenced by UI | SQL | `admin_alerts`, `system_events`, `webhook_events`, `discount_codes`, `marketplace_banners`, `payment_proofs`, `platform_revenue`, `seller_earnings`, `seller_kyc_log`, `application_prep` — all in MASTER_GOD_SQL. |
| 8 | Storage 403 on payment-proofs / seller-kyc | SQL | Owner-scoped + admin override policies (§ 03). |
| 9 | Backend health card silently blank | Frontend | AdminBackendHealth pings External auth + primary client. |

## Edge Functions

All 12 functions live in Lovable Cloud project `vmqqkebojldjsyxcewdb`
(see `supabase/config.toml`). Client code MUST use `invokeEdgeFunction`
from `src/lib/lovableFunctions.ts`; do NOT use `supabase.functions.invoke`
while the client is pinned to External.

| Function | Client call sites |
|----------|-------------------|
| create-residence-portal-user | `AdminResidencePortals.tsx` |
| generate-booking-slip | `Applications.tsx` |
| update-application-status | `residence/ResidenceApplicationDetail.tsx` |
| download-handover-pack | `components/admin/HandoverExportPanel.tsx` (direct URL — OK) |
| resbot-ai | `ResBot.tsx` (direct URL — OK) |
| yoco-* / send-push / vapid-public-key / og-image / referral-capture | server-to-server or public — no admin action required |

## Deploy Order

1. Run `docs/MASTER_GOD_SQL.sql` in the External Supabase SQL editor.
2. Re-open Admin → Operations Hub → Portals; the list must now load with joined residence names.
3. Re-open Admin → System Hub → Backend Health; both ping cards must be green.
4. Verification block at the bottom of MASTER_GOD_SQL must return sensible counts and non-empty function/bucket/table lists.

## Rules to preserve (do not regress)

- Only ONE FK per column on any table with PostgREST embeds. If a rename is
  needed, DROP the old FK in the same migration.
- Every new edge function call must go through `invokeEdgeFunction`.
- Every new `public` table requires GRANTs and RLS in the same migration.
- Never re-introduce a stub page — wire it or delete it.

## Admin SQL pack

A dedicated, rerunnable pack lives at `docs/ADMIN_MASTER_SQL.sql`. Run it on
External Supabase any time an admin page throws. It is independent from
`MASTER_GOD_SQL.sql` and covers:

1. Duplicate FK cleanup on `residence_portal_accounts`
2. Column shims (`application_messages.body`, `applications.funding_type`,
   `hero_slides.subtitle/cta_label/cta_url`, `stores.status/is_verified`,
   `marketplace_listings.status/admin_notes`)
3. Admin-only tables (10) with GRANT + RLS + admin-only policies
4. Admin RPCs: `admin_dashboard_counts`, `admin_recent_activity`,
   `admin_delete_listing`, `admin_toggle_store_verified`,
   `admin_set_application_status`
5. Admin RLS override policies on 15 tables so admin lists never return 0
6. Storage admin override on all sensitive buckets
7. Verification block at the bottom (5 SELECTs)