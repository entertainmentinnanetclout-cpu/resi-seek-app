# SEC-07 / SEC-08 / SEC-21 — Storage Object Privacy & Owner Isolation
**15 November 2026, ResKonnect `mefjzkhobkltlbmhusdh`.**

## Confirmed live security gap
- Supabase `storage.buckets.public=false` did **not** mean storage object metadata was private: an unrestricted policy `Allow public read access to user-profiles` granted `SELECT` on `storage.objects` to `PUBLIC` for the private `user-profiles` bucket. A real SQL session executing as `anon` returned **7 visible private-profile object rows**. We did not enumerate filenames or download files in the audit.
- Two separate permissive `INSERT` policies on public `store-assets` allowed any authenticated user to upload under another user's store-branding folder. With permissive RLS, both policies must be revoked together; restricting one leaves the other open.
- `user-profiles` had a null-owner upload fallback, which is unnecessary for normal user-managed files.
- All 11 existing `store-assets` objects use a user UUID prefix matching their recorded owner; StoreSetup, StoreEdit and SellerOnboarding construct paths using `user.id`. This supports scoped storage policy without breaking their intended path format.
- Other buckets and their known policies are **not** included in this release. No general file MIME/size setting is silently changed.

## Implementation
`supabase/migrations/20261115083500_sec07_sec08_storage_owner_isolation.sql`:
1. Drops only the private `user-profiles` bucket's unrestricted public-read policy. Existing authenticated own-file SELECT/UPDATE/DELETE policies remain.
2. Tightens existing profile INSERT check to `owner = auth.uid()`.
3. Drops the two broad store-assets INSERT policies, replaces them with one policy for authenticated users requiring verified ownership and either their own UUID-prefix folder or an authenticated admin role. Public asset reads are intentionally unchanged.
4. Does not delete any object, change its storage key, reset student sessions, or alter the public `store-assets` bucket flag.

## Verification & rollback
- Before deployment: `anon` can enumerate 7 `user-profiles` rows; 7 profile objects, 11 store assets. These are **object-level RLS observations**, not proof that a third party downloaded a private file.
- Post-deployment acceptance: `anon` must see **zero** profile rows; simulated authenticated owner must still see their owned rows; a non-owner must see zero profile objects belonging to other owners. Store asset `INSERT` policies must be owner-scoped in `pg_policies` with no broad alternate allowed path. All seven GitHub release workflows must pass.
- Failure behavior: non-owner attempts must be denied by Postgres Storage RLS, while authorized own-folder or admin logo upload remains available.
- Rollback only if required for continuity: first inspect RLS/owner assignment and correct the specific owner policy. **Never re-enable anonymous SELECT over private profiles** as an availability workaround. Restore store-assets old policies only after documented high-risk exception approval; prefer reverting dependent clients to owner folders.

## Remaining checks
- Object content sensitivity and actual public Storage download URL behavior require an authorized testing account; no sensitive file contents were fetched.
- Other buckets with missing MIME/size limits need their own non-disruptive review, particularly seller KYC and complaint attachments.
- Supabase Auth rate limits and Turnstile settings are separate hosted controls requiring dashboard access.
