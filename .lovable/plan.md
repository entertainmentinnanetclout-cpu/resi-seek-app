## Emergency Migration Plan — Supabase → Lovable Cloud (with Sync + Abstraction)

### Goal
Restore full functionality TODAY by switching the live data plane to **Lovable Cloud** while keeping every UI, route, workflow, and permission identical. Historical data stays in External Supabase and will sync back once it's restored. Then introduce a backend abstraction layer so ResKonnect can run on any provider via a single config switch.

---

### Phase 1 — Emergency Cutover (Today)

**1. Provision Lovable Cloud as the active backend**
- Enable Lovable Cloud (Supabase-compatible) as the new primary.
- Recreate the full schema on Lovable Cloud from a consolidated master migration built from:
  - `docs/MASTER_SQL_v5.sql`, `MARKETPLACE_REBUILD_SQL.sql`, `HAMPER_AND_EFT_SQL.sql`, `EFT_PAYMENT_SQL.sql`, `LANDLORD_SQL.sql`, `ORDER_TRACKING_SQL.sql`, `SELLER_COMMISSION_SQL.sql`, `SPECIALIST_DASHBOARDS_SQL.sql`, `YOCO_VERIFY_SQL.sql`.
- Recreate all 10 storage buckets (documents, marketplace, admin-images, store-assets, profile-pictures, application-documents, wil-documents, product-images, hamper-images, payment-proofs) with matching policies.
- Recreate roles, RLS, SECURITY DEFINER functions (`has_role`, `get_user_staff_role`, `handle_new_user`, `capture_referral*`, `get_or_create_referral_code`, `is_authorized_residence_user`, `get_user_residence_id`).
- Seed the two admin accounts (`43v3r2a11@gmail.com`, `reskonnect@gmail.com`) into `user_roles` as `admin`.

**2. Introduce a Backend Abstraction Layer (BAL) — minimal first slice**
- New folder `src/backend/` exposing a single typed client:
  - `db` (from/select/insert/update/delete/rpc)
  - `auth` (signIn, signUp, signOut, getSession, onAuthStateChange)
  - `storage` (upload/download/getPublicUrl/remove)
  - `functions` (invoke)
- Driver-based: `src/backend/drivers/lovable.ts` and `src/backend/drivers/supabase.ts` (stub for now, identical surface since both are Supabase-compatible).
- Resolver reads `VITE_BACKEND_PROVIDER` (`lovable` | `supabase`) and picks the driver. Default = `lovable`.
- Re-export `supabase` from `@/integrations/supabase/client` as a thin shim that points at the active driver, so NO existing page needs to change today. (Achieves "no UI/route/workflow change".)

**3. Point the shim at Lovable Cloud**
- Replace the hardcoded `mefjzkhobkltlbmhusdh` URL/key fallbacks in `src/integrations/supabase/client.ts` with the Lovable Cloud URL + anon key (from auto-generated `.env`).
- Update all edge functions that read `EXTERNAL_SUPABASE_URL` / `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` to prefer Lovable Cloud envs, with External as fallback.

**4. Critical edge functions to re-deploy against Lovable Cloud**
`yoco-checkout`, `yoco-webhook`, `yoco-verify-payment`, `update-application-status`, `create-residence-portal-user`, `download-handover-pack`, `generate-booking-slip`, `referral-capture`, `send-push`, `vapid-public-key`, `resbot-ai`, `og-image`.

**5. Smoke-test the Phase 1 surfaces**
- Applications: 2nd Sem / Trimester / 2027 form submit → row in `applications` → visible in `AdminApplications` → document upload to `application-documents` → status update via edge function.
- Find My Res: residence list, filters, availability, detail.
- Accreditation: landlord submission + document upload + admin review.
- Commerce: marketplace browse, store, cart, checkout (EFT + Yoco), hampers, discount orders.

---

### Phase 2 — Sync Engine (when External Supabase is back)

**Architecture**
```text
   Lovable Cloud (active)
          │  trigger → sync_queue
          ▼
    sync_queue table        ── processed by ──▶  sync-worker edge function
          │                                            │
          ▼                                            ▼
    retry/backoff                            External Supabase (mirror)
```

**Components**
- New table `sync_queue` (id, entity, entity_id, op `insert|update|delete`, payload jsonb, status `pending|sent|failed`, attempts, last_error, created_at, sent_at).
- DB triggers on critical tables (`applications`, `application_documents`, `residences`, `shop_orders`, `shop_order_items`, `stores`, `products`, `user_roles`, `profiles`, landlord/accreditation tables) → enqueue change row.
- Edge function `sync-worker` (cron every minute via `pg_cron` + `pg_net`) pulls `pending`, replays into External Supabase using its service role, marks `sent` or increments `attempts` with exponential backoff.
- Idempotent upserts keyed on UUID PKs so replays are safe.
- One-time backfill script `docs/SYNC_BACKFILL.sql` to push the period between cutover and External recovery.

---

### Phase 3 — Health Monitoring (God Mode)

New page `src/pages/admin/AdminBackendHealth.tsx`, added as a tab in `AdminSystemHub` (visible only to `admin`).

Displays:
- **Backend Status** cards:
  - Lovable Cloud: 🟢 / 🔴 (ping `select 1` via RPC)
  - External Supabase: 🟢 / 🔴 (driver ping)
  - Active provider badge (`BACKEND_PROVIDER`)
- **Sync metrics** from `sync_queue`:
  - Last successful sync timestamp
  - Pending records count
  - Failed records (with retry button)
- **Recent failures** table (entity, error, attempts).
- **Manual controls**: "Pause sync", "Resume sync", "Replay failed", "Switch provider" (writes to `platform_settings.active_backend`).

A lightweight banner component (`BackendStatusBanner`) appears site-wide for admins when the active backend is degraded — so we never learn outages from users.

---

### Phase 4 — Backend Portability (Future-proof)

- Expand `src/backend/drivers/` with adapters for:
  - `lovable.ts` (Supabase-compatible)
  - `supabase.ts` (External)
  - `postgres.ts` (PostgREST / direct PG via edge)
  - `firebase.ts` (Firestore + Firebase Auth + Storage adapter)
  - `awsrds.ts` (RDS via a thin REST gateway edge function)
- All app code imports from `@/backend` only. Direct `@supabase/...` imports become forbidden by ESLint rule `no-restricted-imports` (allowlist only `src/backend/drivers/*`).
- Provider chosen at runtime by `VITE_BACKEND_PROVIDER`; auth/storage/db/functions surfaces stay identical.
- Add capability matrix doc `docs/BACKEND_PROVIDERS.md` describing supported features per driver.

---

### Permanent Knowledge-Base Rule (to add)

> ResKonnect must never be tightly coupled to a single backend provider. All database, auth, storage, and admin workflows go through `src/backend/`. Every new feature must support backend portability across Lovable Cloud, Supabase, PostgreSQL, Firebase, and AWS RDS without frontend changes. A sync engine mirrors writes to secondary providers, and the God Mode Backend Health dashboard surfaces provider/sync status. If a backend becomes unavailable, the platform keeps running on the active provider without interruption.

Saved to both project memory (`mem://architecture/backend-abstraction`) and workspace knowledge.

---

### Technical Details

- **No UI/route changes in Phase 1.** All existing files keep `import { supabase } from "@/integrations/supabase/client"`; that module becomes a re-export of the active driver.
- **Cloud secrets needed:** `EXTERNAL_SUPABASE_URL`, `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`, `EXTERNAL_SUPABASE_ANON_KEY` (kept for sync-worker); Lovable Cloud secrets auto-injected.
- **Edge function `verify_jwt`** preserved per current setup (`yoco-webhook` stays public; admin functions stay JWT-validated in code).
- **RLS parity:** every policy from External re-applied verbatim on Lovable Cloud as part of the master migration. Confirmed with `supabase--linter` after migration.
- **Data backfill on Supabase recovery:** one-shot import (CSV or `pg_dump` provided by you, since Lovable Cloud blocks outbound `pg_dump`). Existing IDs preserved → safe re-merge.

---

### Deliverables Checklist
1. Master migration applied to Lovable Cloud (schema + RLS + functions + buckets).
2. `src/backend/` abstraction with `lovable` + `supabase` drivers + shim.
3. Edge functions re-deployed and pointed at Lovable Cloud.
4. `sync_queue` + triggers + `sync-worker` cron edge function.
5. `AdminBackendHealth` tab inside System Hub (God Mode).
6. ESLint rule banning direct `@supabase/*` imports outside `src/backend/drivers/`.
7. KB rule saved to memory; `docs/BACKEND_PROVIDERS.md` authored.

**Confirmations needed before I build:**
- OK to recreate the schema on Lovable Cloud from the consolidated master SQL (no historical row migration today)?
- OK to switch the default of `src/integrations/supabase/client.ts` away from the hardcoded External URL to Lovable Cloud?
