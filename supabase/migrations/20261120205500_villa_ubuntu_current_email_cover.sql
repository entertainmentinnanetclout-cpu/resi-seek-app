-- Villa Ubuntu's current residence listing cover was updated in November,
-- but its September ResMap primary media row still referenced an old property.
-- Repair only that known stale published row. Previously sent Gmail messages
-- remain immutable, and the former storage object is not deleted.
UPDATE public.resmap_residence_media AS media
SET url = residence.image_url,
    thumbnail_url = NULL,
    title = 'Current residence listing cover',
    updated_at = NOW()
FROM public.residences AS residence
WHERE residence.id = media.residence_id
  AND residence.id = '3824a8f4-2ef7-406d-996b-2f2f7785dd74'::uuid
  AND residence.name = 'Villa Ubuntu Student Accommodation'
  AND media.id = 'cd829172-9735-41a1-a628-9cd20898daeb'::uuid
  AND media.media_type = 'photo'
  AND media.is_published IS TRUE
  AND media.is_primary IS TRUE
  AND media.url = 'https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/admin-images/residence-1767530456159.JPG'
  AND residence.image_url = 'https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/admin-images/residence-1794394036962.jpeg'
  AND EXISTS (
    SELECT 1 FROM storage.objects AS obj
    WHERE obj.bucket_id = 'admin-images'
      AND obj.name = 'residence-1794394036962.jpeg'
      AND obj.metadata->>'mimetype' = 'image/jpeg'
  );
