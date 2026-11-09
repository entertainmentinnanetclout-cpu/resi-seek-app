-- Applied to External Supabase mefjzkhobkltlbmhusdh on 2026-11-09 as marketplace_readiness_2026_11_09.
-- Safe, read-only public evidence model. Never infer official accreditation or a booking guarantee.
CREATE OR REPLACE VIEW public.reskonnect_marketplace_readiness_v
WITH (security_invoker = true, security_barrier = true)
AS
WITH evidence AS (
  SELECT
    r.id AS residence_id,
    r.is_visible,
    (
      NULLIF(BTRIM(COALESCE(r.cover_image_url, '')), '') IS NOT NULL
      OR NULLIF(BTRIM(COALESCE(r.image_url, '')), '') IS NOT NULL
      OR COALESCE(array_length(r.images, 1), 0) > 0
      OR EXISTS (SELECT 1 FROM public.resmap_residence_media m WHERE m.residence_id = r.id AND m.is_published = true)
    ) AS has_photo_reference,
    (
      (r.price_verified_at IS NOT NULL AND
        (COALESCE(r.private_price, 0) > 0 OR COALESCE(r.price, 0) > 0))
      OR EXISTS (
        SELECT 1 FROM public.residence_room_types rt
        WHERE rt.residence_id = r.id AND rt.is_active = true AND COALESCE(rt.private_price, 0) > 0 AND rt.price_verified_at IS NOT NULL
      )
    ) AS has_verified_private_price,
    (
      r.location_verification_status = 'verified'
      AND r.latitude BETWEEN -90 AND 90 AND r.longitude BETWEEN -180 AND 180
    ) AS has_verified_location,
    EXISTS (
      SELECT 1 FROM public.residence_room_types rt
      WHERE rt.residence_id = r.id AND rt.is_active = true
        AND COALESCE(rt.private_price, 0) > 0 AND COALESCE(rt.capacity, 0) > 0
        AND rt.available_beds BETWEEN 0 AND rt.capacity
    ) AS has_configured_room_rate,
    NULLIF(BTRIM(COALESCE(r.name, '')), '') IS NOT NULL
      AND NULLIF(BTRIM(COALESCE(r.city, '')), '') IS NOT NULL
      AND NULLIF(BTRIM(COALESCE(r.description, '')), '') IS NOT NULL
      AS has_basic_listing_details
  FROM public.residences r WHERE r.is_visible = true
)
SELECT
  e.residence_id, e.has_photo_reference, e.has_verified_private_price,
  e.has_verified_location, e.has_configured_room_rate, e.has_basic_listing_details,
  (e.has_photo_reference AND e.has_verified_private_price AND e.has_verified_location
    AND e.has_configured_room_rate AND e.has_basic_listing_details) AS marketplace_review_ready,
  (
    CASE WHEN e.has_photo_reference THEN 25 ELSE 0 END
    + CASE WHEN e.has_verified_private_price THEN 25 ELSE 0 END
    + CASE WHEN e.has_verified_location THEN 15 ELSE 0 END
    + CASE WHEN e.has_configured_room_rate THEN 25 ELSE 0 END
    + CASE WHEN e.has_basic_listing_details THEN 10 ELSE 0 END
  )::integer AS readiness_score,
  array_remove(ARRAY[
    CASE WHEN NOT e.has_photo_reference THEN 'photo_reference'::text END,
    CASE WHEN NOT e.has_verified_private_price THEN 'verified_private_price'::text END,
    CASE WHEN NOT e.has_verified_location THEN 'verified_location'::text END,
    CASE WHEN NOT e.has_configured_room_rate THEN 'configured_room_rate'::text END,
    CASE WHEN NOT e.has_basic_listing_details THEN 'basic_listing_details'::text END
  ], NULL::text) AS readiness_gaps
FROM evidence e;
REVOKE ALL ON public.reskonnect_marketplace_readiness_v FROM PUBLIC;
GRANT SELECT ON public.reskonnect_marketplace_readiness_v TO anon, authenticated;
COMMENT ON VIEW public.reskonnect_marketplace_readiness_v IS
'Public, security-invoker evidence completeness; no accreditation or booking guarantee. Only visible residences.';
