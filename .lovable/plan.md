## Admin Master SQL — dedicated pack

Create `docs/ADMIN_MASTER_SQL.sql` — a single, rerunnable pack scoped only to what the Admin console needs on External Supabase. Independent from `MASTER_GOD_SQL.sql` so it can be re-run any time an admin page throws.

### Scope (only admin surface)

1. **FK / embed cleanup** — drop duplicate FK on `residence_portal_accounts` (`residence_portal_accounts_residence_id_fkey`), keep `fk_portal_accounts_residence`. `NOTIFY pgrst, 'reload schema'` at the end.
2. **Missing columns the admin UI reads** — add-if-missing:
   - `application_messages.body TEXT` (deployed code reads `body`, current schema has `message`) + backfill `body := message`.
   - `applications.funding_type` shim mirroring `funding_source`.
   - `hero_slides.subtitle`, `cta_label`, `cta_url` defaults.
   - `stores.status`, `is_verified` defaults for moderation list.
   - `marketplace_listings.status`, `admin_notes`.
3. **Admin-only tables** (create-if-missing, with GRANTs + RLS + admin-only policies via `has_role(auth.uid(),'admin')`):
   `admin_alerts`, `system_events`, `webhook_events`, `payment_action_logs`, `platform_revenue`, `seller_earnings`, `seller_kyc_log`, `call_logs` (if absent), `whatsapp_templates` (if absent), `filter_config` (if absent).
4. **RPCs the admin UI calls** — create-or-replace:
   - `admin_dashboard_counts()` → single JSON blob (users, applications by status, residences, orders, listings pending, revenue MTD).
   - `admin_recent_activity(_limit int)` → union of latest applications / orders / listings.
   - `admin_delete_listing(_id uuid)`, `admin_toggle_store_verified(_id uuid, _v bool)`, `admin_set_application_status(_id uuid, _status text, _note text)` — all `SECURITY DEFINER`, gated by `has_role('admin')`.
5. **RLS audit for admin visibility** — add `USING (public.has_role(auth.uid(),'admin'))` admin-override policies on every table the admin lists but currently returns 0 rows on: `stores`, `products`, `marketplace_listings`, `shop_orders`, `payment_proofs`, `discount_orders`, `hamper_orders`, `landlord_applications`, `wil_applications`.
6. **Storage policies** — admin read/write override on `payment-proofs`, `seller-kyc`, `landlord-documents`, `wil-documents`, `application-documents`.
7. **Verification block at the bottom** — SELECTs that must all return sensible counts:
   - duplicate FKs on `residence_portal_accounts` (must be 0)
   - missing columns list (must be empty)
   - admin tables present (9 rows)
   - policies with `has_role('admin')` count per table
   - `admin_dashboard_counts()` sample invocation

### Deliverables

- `docs/ADMIN_MASTER_SQL.sql` — the pack (rerunnable, wrapped in `DO $$ … $$` where needed).
- Append a short "Admin SQL" section to `docs/ADMIN_DEEP_SCAN_REPORT.md` pointing at the new file and listing the verification queries.

No frontend code changes in this pack — the report already tracked those. If verification reveals a still-broken admin page after you run this, paste the exact failing statement and I'll patch the next mismatch in the same pack.
