insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('tour-capture-private','tour-capture-private',false,26214400,array['image/jpeg','image/png','image/webp']),
('tour-masters-private','tour-masters-private',false,52428800,array['image/jpeg','image/png','image/webp']),
('tour-delivery-public','tour-delivery-public',true,26214400,array['image/jpeg','image/webp']),
('tour-thumbnails-public','tour-thumbnails-public',true,8388608,array['image/jpeg','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists virtual_tour_assets_owner_insert on storage.objects;
create policy virtual_tour_assets_owner_insert on storage.objects for insert to authenticated with check (
 bucket_id in ('tour-capture-private','tour-masters-private','tour-delivery-public','tour-thumbnails-public')
 and array_length(storage.foldername(name),1)>=1
 and public.virtual_tour_can_manage_residence(((storage.foldername(name))[1])::uuid)
);
drop policy if exists virtual_tour_assets_owner_update on storage.objects;
create policy virtual_tour_assets_owner_update on storage.objects for update to authenticated using (
 bucket_id in ('tour-capture-private','tour-masters-private','tour-delivery-public','tour-thumbnails-public')
 and public.virtual_tour_can_manage_residence(((storage.foldername(name))[1])::uuid)
) with check (public.virtual_tour_can_manage_residence(((storage.foldername(name))[1])::uuid));
drop policy if exists virtual_tour_assets_owner_delete on storage.objects;
create policy virtual_tour_assets_owner_delete on storage.objects for delete to authenticated using (
 bucket_id in ('tour-capture-private','tour-masters-private','tour-delivery-public','tour-thumbnails-public')
 and public.virtual_tour_can_manage_residence(((storage.foldername(name))[1])::uuid)
);
