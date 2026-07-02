-- ============================================================================
-- DIVERSIFICATION + ADMIN UPGRADE SQL PACK
-- Idempotent, safe to re-run.
-- Run on the EXTERNAL Supabase (mefjzkhobkltlbmhusdh) production database.
-- ============================================================================

-- 1. Spotlight columns on residences
ALTER TABLE public.residences
  ADD COLUMN IF NOT EXISTS is_spotlight boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spotlight_rank int;

CREATE INDEX IF NOT EXISTS idx_residences_spotlight
  ON public.residences(is_spotlight, spotlight_rank)
  WHERE is_spotlight = true;

-- 2. Audience/accreditation flags (safe defaults)
ALTER TABLE public.residences
  ADD COLUMN IF NOT EXISTS accepts_university boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_tvet boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_nsfas boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS institution_tags text[] NOT NULL DEFAULT '{}';

-- 3. Backfill: every existing residence is currently a TUT / University accommodation
UPDATE public.residences
   SET accepts_university = true
 WHERE accepts_university IS DISTINCT FROM true;

-- 4. Applications: institution_type column so admins can filter TUT / TVET / Private / Other
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS institution_type text;

CREATE INDEX IF NOT EXISTS idx_applications_institution_type
  ON public.applications(institution_type);

-- Optional constraint (trigger-based, not CHECK, so future values can be added)
CREATE OR REPLACE FUNCTION public.validate_application_institution_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.institution_type IS NOT NULL
     AND NEW.institution_type NOT IN ('university','tvet','private','other') THEN
    RAISE EXCEPTION 'institution_type must be one of: university, tvet, private, other';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_application_institution_type_trg ON public.applications;
CREATE TRIGGER validate_application_institution_type_trg
BEFORE INSERT OR UPDATE OF institution_type ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.validate_application_institution_type();

-- 5. Hero slides: register a new slide_location for Find My Res spotlight-managed slides
-- (No schema change needed — hero_slides already has slide_location text column.)
-- Admins can select 'find_my_res_spotlight' from Media Hub → Slides.

-- 6. Reload the PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 7. Verification
SELECT
  (SELECT COUNT(*) FROM public.residences)                                AS total_residences,
  (SELECT COUNT(*) FROM public.residences WHERE is_spotlight)             AS spotlight_count,
  (SELECT COUNT(*) FROM public.residences WHERE accepts_university)       AS tut_uni_count,
  (SELECT COUNT(*) FROM public.residences WHERE accepts_tvet)             AS tvet_count,
  (SELECT COUNT(*) FROM public.residences WHERE accepts_private)          AS private_count,
  (SELECT COUNT(*) FROM public.applications)                              AS total_applications,
  (SELECT COUNT(*) FROM public.applications WHERE institution_type IS NOT NULL) AS classified_applications;