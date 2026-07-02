-- ============================================================================
-- EXTERNAL_PARITY_2026_02.sql
--
-- Second parity pack for External Supabase (mefjzkhobkltlbmhusdh).
-- Covers everything added to the Lovable mirror AFTER
-- docs/EXTERNAL_PARITY_CATCHUP.sql (run that first if you haven't).
--
-- Contents:
--   01. Audience diversification on residences (University / TVET / Private)
--   02. application_prep table (Applications Hub document vault index)
--   03. Platform settings seeds (marketplace pause, TUT/NSFAS deadlines)
--   04. Hero slide seeds for deadline announcements
--   05. Verification queries
--
-- Idempotent — safe to rerun. Non-destructive.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 01. Audience columns on residences
-- ============================================================================
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS accepts_university boolean NOT NULL DEFAULT true;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS accepts_tvet       boolean NOT NULL DEFAULT false;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS accepts_private    boolean NOT NULL DEFAULT false;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS accepts_nsfas      boolean NOT NULL DEFAULT false;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS institution_tags   text[]  NOT NULL DEFAULT ARRAY[]::text[];

-- Backfill NSFAS from legacy column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='residences' AND column_name='nsfas_accredited'
  ) THEN
    UPDATE public.residences
       SET accepts_nsfas = COALESCE(nsfas_accredited, false)
     WHERE accepts_nsfas IS DISTINCT FROM COALESCE(nsfas_accredited, false);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_residences_accepts_tvet    ON public.residences(accepts_tvet)    WHERE accepts_tvet    = true;
CREATE INDEX IF NOT EXISTS idx_residences_accepts_private ON public.residences(accepts_private) WHERE accepts_private = true;
CREATE INDEX IF NOT EXISTS idx_residences_institution_tags ON public.residences USING gin(institution_tags);

-- ============================================================================
-- 02. application_prep — Applications Hub document vault index
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.application_prep (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target        text NOT NULL CHECK (target IN ('tut','nsfas_university','nsfas_tvet','private')),
  document_type text NOT NULL,
  storage_path  text,
  status        text NOT NULL DEFAULT 'pending',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_prep TO authenticated;
GRANT ALL ON public.application_prep TO service_role;

ALTER TABLE public.application_prep ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "application_prep owner rw" ON public.application_prep;
CREATE POLICY "application_prep owner rw" ON public.application_prep
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "application_prep admin read" ON public.application_prep;
CREATE POLICY "application_prep admin read" ON public.application_prep
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_application_prep_updated ON public.application_prep;
CREATE TRIGGER trg_application_prep_updated
  BEFORE UPDATE ON public.application_prep
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 03. Platform settings seeds
-- ============================================================================
INSERT INTO public.platform_settings (key, value, description)
VALUES
  ('marketplace_paused',
   jsonb_build_object('enabled', true, 'message', 'Marketplace is paused while we grow our accommodation & applications focus.'),
   'When enabled, /marketplace shows the Coming Soon page and the public nav hides the marketplace link.'),
  ('tut_2026_deadline',
   jsonb_build_object('date','2025-09-30','label','TUT 2026 Applications close 30 September 2025'),
   'TUT undergraduate application closing date used by hero slides and Applications Hub.'),
  ('nsfas_tvet_open',
   jsonb_build_object('open', true, 'label','NSFAS TVET Trimester 3 applications open'),
   'NSFAS TVET application window flag.')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = COALESCE(EXCLUDED.description, public.platform_settings.description),
      updated_at = now();

-- ============================================================================
-- 04. Hero slide seeds — deadline announcements
-- ============================================================================
INSERT INTO public.hero_slides (title, subtitle, cta_label, cta_url, is_active, sort_order, slide_location)
SELECT * FROM (VALUES
  ('TUT 2026 Applications', 'Closing 30 September 2025 — get your documents ready', 'Prepare Now', '/apply?target=tut',    true, 10, 'landing'),
  ('NSFAS TVET Now Open',    'Trimester 3 applications are open for TVET students',   'Apply Guide', '/apply?target=nsfas_tvet', true, 11, 'landing')
) AS v(title, subtitle, cta_label, cta_url, is_active, sort_order, slide_location)
WHERE NOT EXISTS (
  SELECT 1 FROM public.hero_slides WHERE title = v.title
);

COMMIT;

-- ============================================================================
-- 05. Verification queries — all should return non-empty
-- ============================================================================
-- Audience columns present:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='residences'
--    AND column_name IN ('accepts_university','accepts_tvet','accepts_private','accepts_nsfas','institution_tags');

-- Application prep table exists with RLS:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname='application_prep';

-- Platform settings seeded:
-- SELECT key FROM public.platform_settings WHERE key IN ('marketplace_paused','tut_2026_deadline','nsfas_tvet_open');

-- Hero slides seeded:
-- SELECT title FROM public.hero_slides WHERE title IN ('TUT 2026 Applications','NSFAS TVET Now Open');