## What the logs show

The active failure is no longer the old `user_roles_user_id_unique` issue. The uploaded logs show repeated portal creation attempts failing at auth-user creation:

- `POST /auth/v1/admin/users` returns `500`
- Database error: `duplicate key value violates unique constraint "profiles_email_key"`
- Follow-up transaction errors: `25P02 current transaction is aborted`

That means the `handle_new_user()` trigger is trying to insert a new profile with an email that already exists in `profiles`, so the auth user creation rolls back before the portal account or `residence_portal` role can be created.

## Fix plan

1. **Patch the Residence Portal SQL pack**
   - Update `docs/RESIDENCE_PORTAL_MASTER_SQL.sql` with a new Phase 0/1 fix for profile-email duplicates.
   - Make `public.handle_new_user()` idempotent for both `id` and `email` conflicts.
   - If an email already exists in `profiles` for another user, preserve the existing profile and allow auth creation to continue by avoiding the duplicate email insert.
   - Keep `user_roles` multi-role safe and keep the legacy unique-index cleanup already added.

2. **Patch the portal edge function**
   - Before calling admin auth create-user, check whether a portal account already exists for the email.
   - If auth create-user fails with the known profile-email duplicate/database-new-user error, return a readable message explaining that the email already exists in profiles and another email should be used or the duplicate profile should be cleaned.
   - Include a stable debug code such as `PROFILE_EMAIL_DUPLICATE` so the admin toast is not `{}`.

3. **Strengthen the admin UI error display**
   - Update `AdminResidencePortals.tsx` error parsing to show nested `debug_code`, `details`, and function version fields when the edge function returns structured failures.
   - Keep current UI/routes/workflow unchanged.

4. **Add a verification block to the SQL pack**
   - Add checks for duplicate profile emails.
   - Add checks that `handle_new_user()` is the safe version.
   - Add checks that no single-column unique index remains on `user_roles(user_id)`.
   - Add checks for portal accounts, portal roles, and duplicate portal emails.

5. **Validate**
   - Use the uploaded logs as the baseline failure.
   - Run a type-safe code check for touched frontend/function files.
   - Provide the exact SQL file to run and the expected verification output after approval.

## Files to change

- `docs/RESIDENCE_PORTAL_MASTER_SQL.sql`
- `supabase/functions/create-residence-portal-user/index.ts`
- `src/pages/admin/AdminResidencePortals.tsx`

## Expected result

Create Residence Portal will stop failing with `{}`. If the email is reusable, portal creation completes. If the email is already tied to a conflicting profile/account, admin sees a clear message instead of a blank error.