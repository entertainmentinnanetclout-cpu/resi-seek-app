-- ============================================================
-- FIND MY RES V3.0 — MASTER SQL PACK (External Supabase)
-- Re-runnable / idempotent. Safe to execute multiple times.
-- Project: mefjzkhobkltlbmhusdh (External Supabase, primary)
-- Mirror : vmqqkebojldjsyxcewdb (Lovable Cloud, standby) — already applied via migration tool
--
-- Run order:
--   1. Section A  — residences column upgrades
--   2. Section B  — slug trigger + backfill
--   3. Section C  — indexes
--   4. Section D  — filter_config table + RLS + seed
--   5. Section E  — verification queries
--   6. Section F  — ROLLBACK (commented; uncomment to revert)
-- ============================================================

BEGIN;

-- ─── A. residences columns ──────────────────────────────────
ALTER TABLE public.residences
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS singles_available integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_tut_accredited boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_furnished boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_wifi boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_parking boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lease_period text,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric,
  ADD COLUMN IF NOT EXISTS utilities_included boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_rank integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS application_count integer DEFAULT 0;

-- Heuristic backfill of category
UPDATE public.residences SET category = CASE
  WHEN category IS NOT NULL THEN category
  WHEN section_category ILIKE '%flat%'   OR room_type ILIKE '%bachelor%' OR room_type ILIKE '%studio%' OR room_type ILIKE '%apartment%' THEN 'flats'
  WHEN section_category ILIKE '%commune%' THEN 'communes'
  WHEN section_category ILIKE '%rental%' OR section_category ILIKE '%private%' THEN 'private_rentals'
  ELSE 'student_residences'
END WHERE category IS NULL;

-- ─── B. slug auto-gen ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_residence_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base text; final text; n int := 0;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN RETURN NEW; END IF;
  base := regexp_replace(lower(coalesce(NEW.name,'res')), '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  IF base = '' THEN base := 'residence'; END IF;
  final := base;
  WHILE EXISTS (SELECT 1 FROM public.residences WHERE slug = final AND id <> NEW.id) LOOP
    n := n + 1; final := base || '-' || n;
  END LOOP;
  NEW.slug := final;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_residences_slug ON public.residences;
CREATE TRIGGER trg_residences_slug
BEFORE INSERT OR UPDATE OF name ON public.residences
FOR EACH ROW EXECUTE FUNCTION public.generate_residence_slug();

UPDATE public.residences SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') || '-' || substring(replace(id::text,'-',''),1,6)
  WHERE slug IS NULL OR slug = '';

-- ─── C. indexes ─────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_residences_slug      ON public.residences(slug);
CREATE INDEX        IF NOT EXISTS idx_residences_category  ON public.residences(category);
CREATE INDEX        IF NOT EXISTS idx_residences_gender    ON public.residences(gender);
CREATE INDEX        IF NOT EXISTS idx_residences_is_trusted ON public.residences(is_trusted);
CREATE INDEX        IF NOT EXISTS idx_residences_is_tut    ON public.residences(is_tut_accredited);
CREATE INDEX        IF NOT EXISTS idx_residences_featured  ON public.residences(is_featured, featured_rank);
CREATE INDEX        IF NOT EXISTS idx_residences_available ON public.residences(available_spots);
CREATE INDEX        IF NOT EXISTS idx_residences_singles   ON public.residences(singles_available);
CREATE INDEX        IF NOT EXISTS idx_residences_campus    ON public.residences(campus);
CREATE INDEX        IF NOT EXISTS idx_residences_price     ON public.residences(price);

-- ─── D. filter_config ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.filter_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  filter_group text NOT NULL DEFAULT 'general',
  display_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  is_multiselect boolean NOT NULL DEFAULT false,
  control_type text NOT NULL DEFAULT 'toggle',
  options jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.filter_config TO anon, authenticated;
GRANT ALL    ON public.filter_config TO service_role;

ALTER TABLE public.filter_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "filter_config_public_read"  ON public.filter_config;
DROP POLICY IF EXISTS "filter_config_admin_write" ON public.filter_config;
CREATE POLICY "filter_config_public_read" ON public.filter_config FOR SELECT USING (true);
CREATE POLICY "filter_config_admin_write" ON public.filter_config FOR ALL
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP TRIGGER IF EXISTS trg_filter_config_updated ON public.filter_config;
CREATE TRIGGER trg_filter_config_updated BEFORE UPDATE ON public.filter_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.filter_config (key, label, filter_group, display_order, is_visible, is_featured, is_multiselect, control_type, options) VALUES
  ('category','Category','primary',1,true,true,false,'select','["flats","communes","student_residences","private_rentals"]'::jsonb),
  ('campus','Campus','primary',2,true,true,false,'select','[]'::jsonb),
  ('price','Price','primary',3,true,true,false,'range','{"min":0,"max":10000}'::jsonb),
  ('gender','Gender','primary',4,true,true,false,'select','["male","female","mixed"]'::jsonb),
  ('nsfas','NSFAS Accredited','accreditation',5,true,true,false,'toggle','[]'::jsonb),
  ('tut','TUT Accredited','accreditation',6,true,true,false,'toggle','[]'::jsonb),
  ('singles','Singles Available','availability',7,true,true,false,'toggle','[]'::jsonb),
  ('available','Available Now','availability',8,true,true,false,'toggle','[]'::jsonb),
  ('furnished','Furnished','amenities',9,true,false,false,'toggle','[]'::jsonb),
  ('wifi','WiFi','amenities',10,true,false,false,'toggle','[]'::jsonb),
  ('parking','Parking','amenities',11,true,false,false,'toggle','[]'::jsonb),
  ('distance','Distance to Campus','location',12,true,false,false,'range','{"min":0,"max":20}'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- ─── E. verification ────────────────────────────────────────
-- SELECT category, count(*) FROM public.residences GROUP BY category;
-- SELECT key, label, filter_group, is_visible, is_featured FROM public.filter_config ORDER BY filter_group, display_order;
-- SELECT id, name, slug FROM public.residences WHERE slug IS NULL;  -- should return 0 rows

-- ─── F. ROLLBACK (uncomment to revert) ──────────────────────
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_filter_config_updated ON public.filter_config;
-- DROP TABLE IF EXISTS public.filter_config;
-- DROP TRIGGER IF EXISTS trg_residences_slug ON public.residences;
-- DROP FUNCTION IF EXISTS public.generate_residence_slug();
-- DROP INDEX IF EXISTS idx_residences_slug, idx_residences_category, idx_residences_gender,
--   idx_residences_is_trusted, idx_residences_is_tut, idx_residences_featured,
--   idx_residences_available, idx_residences_singles, idx_residences_campus, idx_residences_price;
-- ALTER TABLE public.residences
--   DROP COLUMN IF EXISTS category, DROP COLUMN IF EXISTS gender,
--   DROP COLUMN IF EXISTS singles_available, DROP COLUMN IF EXISTS is_tut_accredited,
--   DROP COLUMN IF EXISTS is_furnished, DROP COLUMN IF EXISTS has_wifi,
--   DROP COLUMN IF EXISTS has_parking, DROP COLUMN IF EXISTS lease_period,
--   DROP COLUMN IF EXISTS deposit_amount, DROP COLUMN IF EXISTS utilities_included,
--   DROP COLUMN IF EXISTS slug, DROP COLUMN IF EXISTS is_featured,
--   DROP COLUMN IF EXISTS featured_rank, DROP COLUMN IF EXISTS view_count,
--   DROP COLUMN IF EXISTS application_count;
-- COMMIT;
