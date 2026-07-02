
# Residence Portal Master God Mode SQL

The `{}` you're still seeing means the edge function is throwing an error whose JSON serialization is empty — almost always because the External DB is rejecting one of the two writes (`user_roles` upsert or `residence_portal_accounts` insert) with a Postgres object the JS side can't stringify (constraint name only, no `message`). We're going to stop fighting that from JS and move the whole write into ONE atomic Postgres RPC on External, so the edge function makes a single call and returns Postgres' real error text every time.

## Deliverable

New file: `docs/RESIDENCE_PORTAL_MASTER_SQL.sql` — rerunnable, External-only, self-verifying.

### Phase 1 — Enum + role safety
- Ensure `app_role` enum contains `residence_portal` (add via `ALTER TYPE ... ADD VALUE IF NOT EXISTS`).
- Drop legacy `user_roles_user_id_key` (unique on user_id alone) if present.
- Ensure composite `UNIQUE(user_id, role)` on `user_roles`.
- Ensure `has_role(uuid, app_role)` SECURITY DEFINER exists.

### Phase 2 — `residence_portal_accounts` hardening
- Drop duplicate FK `residence_portal_accounts_residence_id_fkey` (keeps the named one, kills PostgREST embed ambiguity).
- Ensure `PRIMARY KEY (residence_id)` OR unique on `residence_id` so one portal per residence.
- Ensure unique on `user_id` (one portal per auth user).
- Ensure unique on `email` (case-insensitive via functional index).
- Columns: `residence_id`, `user_id`, `email`, `is_active`, `created_at`, `updated_at` (add missing).
- Grants: `SELECT/INSERT/UPDATE/DELETE` to `authenticated`, `ALL` to `service_role`.
- RLS: enable + admin-full, portal-owner self-read.

### Phase 3 — Atomic creator RPC (this is the fix for `{}`)
```sql
CREATE OR REPLACE FUNCTION public.admin_create_residence_portal(
  _residence_id uuid,
  _user_id uuid,
  _email text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```
Behavior:
- Verify caller is admin via `has_role(auth.uid(),'admin')`, else raise.
- Verify residence exists, else raise `residence_not_found`.
- Verify no existing portal on this residence, else raise `portal_exists`.
- Upsert `user_roles(user_id,'residence_portal')` with `ON CONFLICT DO NOTHING`.
- Insert `residence_portal_accounts` row.
- Return `jsonb_build_object('success',true,'residence_id',_residence_id,'user_id',_user_id)`.
- Every failure path uses `RAISE EXCEPTION USING MESSAGE = ...` so PostgREST returns a readable `message` string (no more `{}`).

Companion RPCs:
- `admin_deactivate_residence_portal(_residence_id uuid)`
- `admin_delete_residence_portal(_residence_id uuid)` — also removes `user_roles` row.

Grants: `EXECUTE ... TO authenticated` (guarded by admin check inside).

### Phase 4 — Verification block
Idempotent `SELECT` checks at end:
- Enum contains `residence_portal`.
- `user_roles` composite unique present, legacy unique gone.
- Only one FK on `residence_portal_accounts.residence_id`.
- RPCs exist.
- Row counts.

## Edge function rewire (tiny)
`supabase/functions/create-residence-portal-user/index.ts`:
- After `auth.admin.createUser`, replace the two `.from(...)` writes with a single:
  ```ts
  const { data, error } = await supabaseAdmin.rpc('admin_create_residence_portal', {
    _residence_id: residence_id, _user_id: newUserId, _email: email
  });
  ```
- On error, rollback auth user and return `error.message ?? error.details ?? error.hint ?? 'Unknown Postgres error'` so the UI never sees `{}` again.

## UI (no change needed)
`AdminResidencePortals.tsx` already surfaces `data.error` / thrown message — it will start showing the real Postgres reason once the function returns it.

## Run order
1. Run `docs/RESIDENCE_PORTAL_MASTER_SQL.sql` on External.
2. Edge function auto-redeploys.
3. Retry Create Portal — you'll either succeed, or see the exact failing constraint / condition instead of `{}`.

Approve and I'll ship the SQL pack and the 10-line edge-function swap.
