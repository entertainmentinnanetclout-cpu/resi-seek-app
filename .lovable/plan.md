## Diagnosis

The portal SQL pack was run on the external production database, but the deployed function is currently calling a backend where `admin_create_residence_portal` is missing. That explains why the UI still shows `{}`: the request reaches `create-residence-portal-user`, but the function fails before the portal record/role are created. The verification screenshot also shows `residence_portal_role_count = 0`, confirming no portal role assignment succeeded.

## Plan

1. **Lock the exact failing layer**
   - Add safer response parsing in `invokeEdgeFunction()` so the toast shows the real backend error instead of `{}`.
   - Add structured debug fields for status, function version, and error message without exposing secrets.

2. **Make Create Portal independent of missing RPC cache/state**
   - Update `create-residence-portal-user` to try the atomic RPC first.
   - If the RPC is missing or not visible in the schema cache, fall back to a service-role transactional sequence:
     - create auth user
     - upsert `user_roles` with `residence_portal`
     - insert `residence_portal_accounts`
     - rollback auth user if database writes fail
   - Return clear JSON errors for duplicate email, duplicate residence, missing admin role, missing residence, and database constraint failures.

3. **Strengthen the dedicated Residence Portal SQL pack**
   - Ensure `admin_create_residence_portal()` is definitely created and visible.
   - Add `NOTIFY pgrst, 'reload schema'` after function creation.
   - Add verification checks for:
     - enum role exists
     - composite user role unique exists
     - legacy single-user unique is gone
     - portal RPC exists with exact argument names
     - function execute grants exist
     - portal table grants/RLS are correct
     - duplicate residence/email/user constraints are correct

4. **Wire admin toggle/delete to RPC helpers**
   - Replace direct table update/delete in `AdminResidencePortals` with `admin_set_residence_portal_active` and `admin_delete_residence_portal` through the backend.
   - This keeps admin actions consistent with the hardened SQL pack and prevents RLS/table-policy surprises.

5. **Validate after implementation**
   - Deploy the updated function.
   - Test the function endpoint directly with a controlled invalid payload to confirm readable error output.
   - Re-check function logs and database verification queries to confirm the real issue is exposed/resolved.

## Deliverable

- Updated edge function with robust fallback and real error messages.
- Updated admin UI error handling for portal creation/toggle/delete.
- Updated `docs/RESIDENCE_PORTAL_MASTER_SQL.sql` as the specialised external database master pack for Residence Portal.