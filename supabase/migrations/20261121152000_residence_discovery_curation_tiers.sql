-- Residence listing relationship and discovery placement are separate business facts.
-- Existing listings remain visible, searchable, indexable and linked to cases.
-- A public discoverability preference never grants accreditation or records a payment.
ALTER TABLE public.residences
 ADD COLUMN IF NOT EXISTS listing_relationship text NOT NULL DEFAULT 'unclassified',
 ADD COLUMN IF NOT EXISTS discovery_placement text NOT NULL DEFAULT 'automatic';
ALTER TABLE public.residences
 DROP CONSTRAINT IF EXISTS residences_listing_relationship_check,
 ADD CONSTRAINT residences_listing_relationship_check CHECK
  (listing_relationship IN ('unclassified','free','partner','paying'));
ALTER TABLE public.residences
 DROP CONSTRAINT IF EXISTS residences_discovery_placement_check,
 ADD CONSTRAINT residences_discovery_placement_check CHECK
  (discovery_placement IN ('automatic','promote','directory_only'));
COMMENT ON COLUMN public.residences.listing_relationship IS
 'Internal admin-classified commercial relationship. unclassified is not a free/partner/payment assertion. Only administrators verify this fact; paying does not itself grant Sponsored placement.';
COMMENT ON COLUMN public.residences.discovery_placement IS
 'Curated browse control independent of public is_visible. automatic requires a usable real photo reference; promote is admin-approved normal discovery; directory_only allows name search, detail URL, sitemaps and maps but not routine browse rails.';
CREATE INDEX IF NOT EXISTS idx_residences_discovery_placement
 ON public.residences(discovery_placement, listing_relationship) WHERE is_visible IS TRUE;
-- Do not backfill 'partner' or 'paying' from trust badges or old invoice claims:
-- those are not proof of a current agreement or settled payment.
