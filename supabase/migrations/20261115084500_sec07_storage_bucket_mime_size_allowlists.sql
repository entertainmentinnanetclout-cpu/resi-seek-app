-- SEC-07/08: bound new uploads in the twelve legacy buckets without per-bucket limits.
-- Source: live bucket/object metadata, 2026-11-15 (project mefjzkhobkltlbmhusdh).
-- No object deletion, key rename, RLS changes, or change to bucket public/private flags.
-- Historical admin-images 'application/octet-stream' objects (four) remain stored/readable;
-- future untyped/octet-stream uploads are deliberately rejected by the image allowlist.
-- The Storage service validates new uploads using these bucket configuration columns.
-- Limits remain below the Supabase Free-plan global cap of 50 MiB.
do $sec07_bucket_limits$
declare v_rows integer;
begin
  -- Fail closed on concurrent configuration changes or unexpected missing buckets.
  if (select count(*) from storage.buckets
      where id in ('admin-images','bursary-images','campaign-assets','complaint-attachments','hamper-images','marketplace','product-images','profile-pictures','seller-kyc','store-assets','store-banners','user-profiles')
        and file_size_limit is null and allowed_mime_types is null) <> 12 then
    raise exception 'SEC07 bucket baseline has changed; inspect settings before modifying';
  end if;

  update storage.buckets b
  set file_size_limit=limits.max_bytes, allowed_mime_types=limits.mime_types
  from (values
    ('admin-images'::text,25 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']::text[]),
    ('bursary-images'::text,10 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']::text[]),
    ('campaign-assets'::text,10 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']::text[]),
    ('complaint-attachments'::text,15 * 1024 * 1024, ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','image/avif','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]),
    ('hamper-images'::text,10 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']::text[]),
    ('marketplace'::text,10 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']::text[]),
    ('product-images'::text,12 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']::text[]),
    ('profile-pictures'::text,5 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']::text[]),
    ('seller-kyc'::text,15 * 1024 * 1024, ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','image/avif']::text[]),
    ('store-assets'::text,10 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']::text[]),
    ('store-banners'::text,12 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']::text[]),
    ('user-profiles'::text,8 * 1024 * 1024, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']::text[])
  ) as limits(bucket_id,max_bytes,mime_types)
  where b.id=limits.bucket_id
    and b.file_size_limit is null and b.allowed_mime_types is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 12 then
    raise exception 'SEC07 expected to update 12 buckets, updated %',v_rows;
  end if;
end
$sec07_bucket_limits$;
