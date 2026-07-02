# Fix: Preview ≠ Production because Preview is pointing at Lovable Cloud

## Root cause

Two backends are wired in and the preview build is silently picking the wrong one.

```text
Deployed site  reskonnect.lovable.app   → External Supabase (mefjzkhobkltlbmhusdh)   ← correct
Preview site   id-preview--…lovable.app → Lovable Cloud    (vmqqkebojldjsyxcewdb)    ← wrong
```

Why:
1. Lovable Cloud is enabled, so the build injects `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` pointing at the Cloud project.
2. `src/integrations/supabase/client.ts` reads those `VITE_*` vars first — the "External" fallback URL further down is never reached in preview.
3. `src/backend/index.ts` defaults BAL to `supabase`, but its "supabase" driver falls back to the same Lovable client when `VITE_EXTERNAL_SUPABASE_*` are unset — so BAL also lands on Cloud.
4. Every recent migration ran through `supabase--migration`, which is pinned to the Cloud project via `supabase/config.toml`. External is missing the last several months of schema, so even after we repoint the client, some new UI (audience filters, filter_config, handover view, etc.) will 404 until we replay the SQL into External.

Result: preview shows Cloud data + new schema; production shows External data + old schema. They will never match until both sides talk to External on the same schema.

## Fix plan (single pass, no UI changes)

### 1. Hard-pin the frontend to External Supabase
- Rewrite `src/integrations/supabase/client.ts` to construct the client from constants for the External project (URL + anon key) instead of reading `VITE_SUPABASE_*`. This is the only safe way to override the Cloud-injected env at build time.
- Update `src/backend/drivers/supabase.ts` to use the same External constants so the BAL "supabase" driver is authoritative.
- Update `src/backend/drivers/lovable.ts` to also import the shared External client (kept only as a stub — no code path uses Cloud anymore).
- Confirm `src/backend/index.ts` stays on `provider = "supabase"`.

Needed input from you: the External anon key (starts with `eyJ…`). It is a publishable key and safe to hardcode. If you'd rather not paste it, I can request it through the secure secret prompt and read it as `VITE_EXTERNAL_SUPABASE_ANON_KEY` — but the plain-hardcode option is what makes preview and prod identical without relying on env injection.

### 2. Repoint edge functions to External only
- `supabase/functions/*` currently prefer `SUPABASE_URL` (Cloud) and fall back to `EXTERNAL_SUPABASE_URL`. Flip the priority so `EXTERNAL_SUPABASE_URL` / `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` / `EXTERNAL_SUPABASE_ANON_KEY` are used first in: `yoco-checkout`, `yoco-webhook`, `yoco-verify-payment`, `referral-capture`, `send-push`, `download-handover-pack`, `update-application-status`, `generate-booking-slip`, `create-residence-portal-user`, `resbot-ai`, `og-image`.
- These secrets are already set in the project (see `EXTERNAL_SUPABASE_*` in the secrets list) so no new secret prompt is needed.

### 3. Ship one External parity SQL pack (all migrations since audit)
Create `docs/EXTERNAL_PARITY_2026_02.sql` containing every migration that has run against Cloud but not External since the last parity pack, plus the earlier `EXTERNAL_PARITY_CATCHUP.sql` re-included (idempotent):
- Audience columns on `residences` (`accepts_university`, `accepts_tvet`, `accepts_private`, `accepts_nsfas`, `institution_tags`) + backfill defaults.
- `application_prep` table + RLS + GRANT.
- Platform settings seeds: `marketplace_paused`, `tut_2026_deadline`, `nsfas_tvet_open`, hero-slider deadline entries.
- `filter_config`, `sync_queue`, `health_status`, `residence_handover_export_v`, `validate_handover_pack()`, `enforce_marketplace_order_seller()` trigger, `residences.contact_email/contact_phone` REVOKE, tightened RLS from the security fixes, referral RPCs, push_subscriptions.
- Verification block at the bottom (SELECTs that must all return rows).

Deliver as a single copy-paste file — you run it once in the External SQL editor. No new tool-driven migrations against Cloud in this turn.

### 4. Post-deploy verification
- Open both Preview and Production, hit `/findmyres`, `/apply`, `/marketplace`, and admin residences. Both must show the same residence count and audience switches.
- Run "Pre-Export Validation" from admin — must succeed against External.
- Backend Health tab in System Hub must label External as Primary and show Cloud as `disabled`.

### 5. Guardrail note
- Add a short comment in `src/integrations/supabase/client.ts` and `README.md` stating: "This project is externally hosted on Supabase project `mefjzkhobkltlbmhusdh`. Do not use Lovable Cloud env vars. All migrations must be shipped as SQL packs under `docs/EXTERNAL_PARITY_*.sql`."

## What I will NOT change

- No UI, route, hook, or workflow edits. This is purely a data-plane repoint + missing-schema catch-up.
- No new tables or business logic.
- Lovable Cloud is not deleted (I can't) — it is simply left unreferenced.

## One question before I build

Do you want me to hardcode the External anon key directly into `client.ts` (fastest, guarantees preview = prod), or route it through a `VITE_EXTERNAL_SUPABASE_ANON_KEY` secret? Hardcoding is standard for publishable keys and matches how the file already hardcodes the External URL.
