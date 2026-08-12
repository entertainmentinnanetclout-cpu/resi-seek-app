-- ResKonnect Applications Hub — admin-controlled institution branding uploads.
-- Mirrors production migration applications_hub_admin_image_upload.

drop policy if exists "Application hub staff can upload branding" on storage.objects;
create policy "Application hub staff can upload branding"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'admin-images'
    and name like 'applications-hub/%'
    and public.is_platform_staff()
  );

drop policy if exists "Application hub staff can update branding" on storage.objects;
create policy "Application hub staff can update branding"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'admin-images'
    and name like 'applications-hub/%'
    and public.is_platform_staff()
  )
  with check (
    bucket_id = 'admin-images'
    and name like 'applications-hub/%'
    and public.is_platform_staff()
  );

drop policy if exists "Application hub staff can delete branding" on storage.objects;
create policy "Application hub staff can delete branding"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'admin-images'
    and name like 'applications-hub/%'
    and public.is_platform_staff()
  );
