-- Public delivery media is readable; capture/master buckets remain private.
create policy if not exists "360 public delivery read"
on storage.objects for select
to public
using (bucket_id in ('tour-delivery-public','tour-thumbnails-public'));
