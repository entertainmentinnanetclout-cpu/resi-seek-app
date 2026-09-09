-- Public delivery media is readable; capture/master buckets remain private.
drop policy if exists virtual_tour_public_delivery_read on storage.objects;
create policy virtual_tour_public_delivery_read
on storage.objects for select
to public
using (bucket_id in ('tour-delivery-public','tour-thumbnails-public'));
