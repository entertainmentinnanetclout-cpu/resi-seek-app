
# MASTER_GOD_SQL — Full UI ↔ External Supabase Alignment

## Goal
One rerunnable SQL pack that guarantees every read, write, RPC, storage upload, and realtime channel the frontend performs works on External Supabase (`mefjzkhobkltlbmhusdh`) — no drift, no missing columns, no broken policies.

## Phase 1 — Deep Frontend Scan (read-only)
Automated sweep to build the authoritative touchpoint inventory:

1. **Tables & columns** — `rg` all `.from('…')`, `.select('…')`, `.insert/update/upsert({…})` calls in `src/**` and `supabase/functions/**`. Cross-reference against `information_schema.columns` on External.
2. **RPCs** — `rg` all `.rpc('…')` calls; verify each function exists on External with matching signature.
3. **Storage** — `rg` all `.storage.from('…')` calls; verify bucket exists + policy set.
4. **Realtime** — `rg` `.channel(`/`postgres_changes`; ensure `REPLICA IDENTITY FULL` + `supabase_realtime` publication.
5. **Edge functions** — inventory `supabase/functions/*/index.ts` for table/RPC use.
6. **Views** — list every `_v` view the UI reads (handover, seller profile, etc.).

Output: `docs/UI_DB_TOUCHPOINT_MATRIX.md` — table × operation × caller × required grants.

## Phase 2 — Author `docs/MASTER_GOD_SQL.sql`
Single idempotent file, safe to rerun, sectioned:

```text
00  Preflight        — extensions, roles, schema sanity
01  Enums & types    — app_role, order status, etc.
02  Core auth glue   — profiles, user_roles, has_role(), handle_new_user
03  Residences       — residences (+audience cols), sections, portal accounts, analytics, favorites, reviews
04  Applications     — applications, documents, messages, activity_log, application_prep, landlord_*
05  Content          — hero_slides, campus_news, events, bursaries, filter_config
06  Commerce         — stores, products, product_categories, product_variants,
                       cart, cart_items, shop_orders, shop_order_items,
                       hampers, hamper_items, hamper_bundle_items, hamper_orders, hamper_order_items,
                       marketplace_listings, marketplace_orders, delivery_zones,
                       discount_orders, student_discounts, student_hamper_preferences,
                       store_reviews, order_status_history
07  Payments         — payments, eft_payments, payment_proofs, payment_action_logs, payment_rate_limits
08  Referrals/Push   — referral_codes, referral_earnings, referral_claims, push_subscriptions
09  Ops/System       — notifications, whatsapp_templates, platform_settings, call_logs,
                       wil_applications, wil_documents, wil_assignments, wil_admin_notes,
                       health_status, sync_queue
10  Views            — residence_handover_export_v, marketplace_seller_profiles (security_invoker)
11  Functions/RPCs   — has_role, get_user_staff_role, is_authorized_residence_user,
                       get_user_residence_id, generate_residence_slug, generate_ref_code,
                       enforce_marketplace_order_seller, validate_referral_code,
                       capture_referral, capture_referral_sale, get_or_create_referral_code,
                       validate_handover_pack, update_updated_at_column,
                       prevent_last_admin_deletion, handle_new_user
12  Triggers         — updated_at on every table, slug trigger on residences,
                       new_user on auth.users, marketplace order integrity, admin-deletion guard
13  Storage buckets  — documents, marketplace, admin-images, store-assets, profile-pictures,
                       application-documents, wil-documents, product-images, hamper-images,
                       landlord-documents, payment-proofs  (+ RLS policies scoped to owner/admin)
14  Realtime         — REPLICA IDENTITY FULL + publication add for hot tables
15  Grants           — explicit GRANT block per table (anon/authenticated/service_role)
16  RLS policies     — full policy set matching current UI behaviour
17  Seeds            — platform_settings (deadlines, marketplace pause, referral %, banking),
                       filter_config defaults, hero_slides deadline slides, delivery_zones
18  Schema-repair    — every ADD COLUMN IF NOT EXISTS the recent packs introduced
                       (audience cols, slug, subtitle→description alias, funding_type, name NOT NULL relax, etc.)
19  Verification     — SELECTs that must all return rows (printed at end)
```

### Idempotency rules
- Every statement uses `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP POLICY IF EXISTS … CREATE POLICY …`.
- Column adds wrapped in `DO $$ … information_schema … $$`.
- No destructive drops on user data tables.
- Runs cleanly on: fresh DB, current External DB, or partially-migrated DB.

### Schema-repair block (learned from tonight's errors)
- `hero_slides`: use existing `description/cta_text/cta_link/display_order`; ensure `image_url` seeds have a placeholder.
- `filter_config`: relax legacy `name NOT NULL`.
- `applications`: ensure `funding_type` exists (mirror `funding_source` if present).
- `residences`: `accepts_university/tvet/private/nsfas`, `institution_tags`, `slug`.
- `application_prep`, `push_subscriptions`, `referral_codes/earnings/claims`, `delivery_zones`, `health_status`, `sync_queue` created if missing.

## Phase 3 — Verification Harness
Bottom of the pack prints:

```sql
-- Expect: all counts > 0 for tables the UI reads on load
SELECT 'residences'   AS t, count(*) FROM public.residences
UNION ALL SELECT 'hero_slides',    count(*) FROM public.hero_slides
UNION ALL SELECT 'filter_config',  count(*) FROM public.filter_config
UNION ALL SELECT 'platform_settings', count(*) FROM public.platform_settings;

-- Expect: every RPC callable
SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname IN ('has_role','get_user_staff_role','get_or_create_referral_code',
                  'validate_referral_code','capture_referral','capture_referral_sale',
                  'validate_handover_pack','enforce_marketplace_order_seller');

-- Expect: every bucket exists
SELECT id FROM storage.buckets ORDER BY id;
```

Plus a companion `docs/UI_DB_VALIDATION_REPORT.md` generated after the run that lists any residual gaps.

## Deliverables
1. `docs/UI_DB_TOUCHPOINT_MATRIX.md` — the scan output.
2. `docs/MASTER_GOD_SQL.sql` — the single file to run on External.
3. `docs/UI_DB_VALIDATION_REPORT.md` — post-run checklist template.
4. Short README note pointing operators to run **only** `MASTER_GOD_SQL.sql` going forward (supersedes prior parity packs, which stay for history).

## Non-goals
- No frontend refactors in this phase.
- No data migration/backfill beyond seed rows.
- No changes to `auth`, `storage`, `realtime`, `vault` internals.

## Risk & Rollback
- Pack is additive + idempotent → rollback = do nothing.
- Any policy replacement is `DROP … IF EXISTS` + `CREATE` in the same transaction, so partial failure aborts cleanly.
- Run inside `BEGIN;/COMMIT;` blocks per section so a failure in section N doesn't corrupt sections 1..N-1.
