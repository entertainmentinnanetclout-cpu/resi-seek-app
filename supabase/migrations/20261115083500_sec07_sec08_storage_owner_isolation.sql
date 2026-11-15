-- SEC-07/08/21: close anonymous visibility on private profile objects
-- and prevent cross-account uploads into public store-branding folders.
-- The existing owner SELECT/UPDATE/DELETE policies are intentionally retained.
-- No storage.objects records, filenames, URLs, or customer data are deleted.

-- Private user-profiles currently has a global public SELECT policy even though
-- storage.buckets.public=false. This exposed 7 object rows to the anon role.
drop policy if exists "Allow public read access to user-profiles" on storage.objects;

-- Never accept ownerless user-profile uploads via browser JWTs. Existing
-- owner-scoped SELECT/UPDATE/DELETE policies stay in place for legitimate users.
alter policy "Allow authenticated uploads to user-profiles" on storage.objects
  with check (
    bucket_id = 'user-profiles'
    and auth.uid() is not null
    and owner = auth.uid()
  );

-- Both old permissive INSERT policies must be removed: RLS permissive policies
-- combine with OR, so leaving either would preserve arbitrary cross-owner paths.
drop policy if exists "Authenticated users can upload store assets" on storage.objects;
drop policy if exists "Users can upload store assets" on storage.objects;

create policy "store-assets owner-scoped insert"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'store-assets'
  and auth.uid() is not null
  and owner = auth.uid()
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);
