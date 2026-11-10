-- Read-only aggregated city footprint for Phase 5 local housing search.
-- No contact details, exact addresses, student records or unverified accreditation.
-- SECURITY INVOKER preserves the underlying residences RLS policies.
CREATE OR REPLACE VIEW public.reskonnect_city_coverage_v
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  lower(btrim(r.city))::text AS city_key,
  min(r.city)::text AS city,
  count(*)::integer AS published_residences,
  count(*) FILTER (
    WHERE greatest(coalesce(r.price, 0), coalesce(r.private_price, 0)) > 0
  )::integer AS published_private_rent_references,
  count(*) FILTER (WHERE r.accepts_nsfas IS TRUE)::integer AS accepts_nsfas_count,
  count(*) FILTER (WHERE r.reservations_2027_open IS TRUE)::integer AS reservation_interest_2027_count,
  count(*) FILTER (WHERE r.available_spots > 0)::integer AS reported_spots_listings,
  count(*) FILTER (WHERE q.has_photo_reference IS TRUE)::integer AS photo_reference_listings,
  count(*) FILTER (WHERE q.has_verified_private_price IS TRUE)::integer AS verified_price_listings,
  count(*) FILTER (WHERE q.has_verified_location IS TRUE)::integer AS verified_location_listings,
  count(*) FILTER (WHERE q.marketplace_review_ready IS TRUE)::integer AS review_ready_listings
FROM public.residences r
LEFT JOIN public.reskonnect_marketplace_readiness_v q ON q.residence_id = r.id
WHERE r.is_visible IS TRUE AND NULLIF(btrim(r.city), '') IS NOT NULL
GROUP BY lower(btrim(r.city));

REVOKE ALL ON public.reskonnect_city_coverage_v FROM PUBLIC;
GRANT SELECT ON public.reskonnect_city_coverage_v TO anon, authenticated;
COMMENT ON VIEW public.reskonnect_city_coverage_v IS
'RLS-respecting published housing footprint. Reported prices, funding acceptance and spots are not official accreditation, verified rent or confirmed booking availability.';