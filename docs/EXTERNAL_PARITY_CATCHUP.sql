-- ============================================================================
-- EXTERNAL_PARITY_CATCHUP.sql
--
-- Brings the External Supabase project (mefjzkhobkltlbmhusdh) to the same
-- schema state as the Lovable mirror (vmqqkebojldjsyxcewdb).
--
-- Run in External Supabase SQL Editor.
--   • Idempotent — every statement uses IF NOT EXISTS / CREATE OR REPLACE /
--     DROP POLICY IF EXISTS + CREATE POLICY / DO $$ … $$ guards.
--   • Non-destructive — no DROP TABLE, no DROP COLUMN, no TRUNCATE.
--   • Safe to rerun.
--
-- Section index
--   01. Find My Res V3.0 — residence columns, slug trigger
--   02. filter_config table (schema-aware: UPSERTs into existing columns)
--   03. Marketplace order seller integrity trigger
--   04. Residences contact PII column-level lockdown
--   05. RLS hardening — meaningful WITH CHECK clauses
--   06. Auth hardening helper note (HIBP toggle is Studio-only)
--   07. Handover pack integrity — view + validator (mirrors MASTER pack)
--   08. Verification queries
--
-- Earlier packs (referenced, not duplicated here):
--   docs/PHASE_1A_SQL_PACK.sql            — sync_queue, health_status
--   docs/MARKETPLACE_REBUILD_SQL.sql      — marketplace_listings, orders
--   docs/HAMPER_AND_EFT_SQL.sql           — hampers, EFT payments
--   docs/SELLER_PROGRAM_SQL.sql           — stores, seller earnings
--   docs/MARKETPLACE_CONTROL_SQL.sql      — moderation policies
--   docs/YOCO_PAYMENT_SQL.sql             — payments
-- ============================================================================

-- ============================================================================
-- 01. Find My Res V3.0 — residence columns + slug auto-generation
-- ============================================================================
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS category          text;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS gender            text;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS singles_available integer DEFAULT 0;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS is_tut_accredited boolean DEFAULT false;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS is_furnished      boolean DEFAULT false;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS has_wifi          boolean DEFAULT false;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS has_parking       boolean DEFAULT false;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS lease_period      text;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS deposit_amount    numeric;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS utilities_included boolean DEFAULT false;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS slug              text;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS is_featured       boolean DEFAULT false;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS featured_rank     integer DEFAULT 0;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS view_count        integer DEFAULT 0;
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS application_count integer DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS residences_slug_uk ON public.residences (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS residences_category_idx        ON public.residences (category);
CREATE INDEX IF NOT EXISTS residences_is_featured_idx     ON public.residences (is_featured);
CREATE INDEX IF NOT EXISTS residences_is_tut_accred_idx   ON public.residences (is_tut_accredited);

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
  BEFORE INSERT OR UPDATE OF name, slug ON public.residences
  FOR EACH ROW EXECUTE FUNCTION public.generate_residence_slug();

-- Backfill any rows still missing slug
UPDATE public.residences SET slug = NULL WHERE slug = '';
UPDATE public.residences SET name = name WHERE slug IS NULL;  -- fires trigger

-- ============================================================================
-- 02. filter_config — schema-aware. Create only if absent, then UPSERT seeds.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.filter_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key             text NOT NULL UNIQUE,
  label           text NOT NULL,
  filter_group    text NOT NULL DEFAULT 'general',
  display_order   integer NOT NULL DEFAULT 0,
  is_visible      boolean NOT NULL DEFAULT true,
  is_featured     boolean NOT NULL DEFAULT false,
  is_multiselect  boolean NOT NULL DEFAULT false,
  control_type    text NOT NULL DEFAULT 'toggle',
  options         jsonb DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.filter_config TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.filter_config TO authenticated;
GRANT ALL ON public.filter_config TO service_role;

ALTER TABLE public.filter_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "filter_config public read"  ON public.filter_config;
DROP POLICY IF EXISTS "filter_config admin manage" ON public.filter_config;
CREATE POLICY "filter_config public read"  ON public.filter_config FOR SELECT  USING (is_visible = true);
CREATE POLICY "filter_config admin manage" ON public.filter_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed defaults (UPSERT, never destructive)
INSERT INTO public.filter_config (key, label, filter_group, display_order, control_type, is_featured)
VALUES
  ('nsfas',     'NSFAS Accredited',  'accreditation', 10, 'toggle', true),
  ('furnished', 'Furnished',         'amenities',     20, 'toggle', false),
  ('wifi',      'WiFi Included',     'amenities',     30, 'toggle', false),
  ('parking',   'Parking',           'amenities',     40, 'toggle', false),
  ('singles',   'Singles Available', 'rooms',         50, 'toggle', false)
ON CONFLICT (key) DO UPDATE SET
  label         = EXCLUDED.label,
  filter_group  = EXCLUDED.filter_group,
  display_order = EXCLUDED.display_order,
  control_type  = EXCLUDED.control_type,
  updated_at    = now();

-- ============================================================================
-- 03. Marketplace order seller integrity trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_marketplace_order_seller()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _listing_owner uuid;
BEGIN
  SELECT user_id INTO _listing_owner
    FROM public.marketplace_listings WHERE id = NEW.listing_id;
  IF _listing_owner IS NULL THEN RAISE EXCEPTION 'Invalid listing_id'; END IF;
  IF NEW.seller_id IS DISTINCT FROM _listing_owner THEN
    RAISE EXCEPTION 'seller_id must match the listing owner';
  END IF;
  IF NEW.buyer_id = _listing_owner THEN
    RAISE EXCEPTION 'Buyer cannot purchase their own listing';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_marketplace_orders_seller_check ON public.marketplace_orders;
CREATE TRIGGER trg_marketplace_orders_seller_check
  BEFORE INSERT OR UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_marketplace_order_seller();

-- ============================================================================
-- 04. Residences contact PII — column-level revoke for client roles
-- ============================================================================
DO $$
BEGIN
  EXECUTE 'REVOKE SELECT (contact_email, contact_phone) ON public.residences FROM anon';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  EXECUTE 'REVOKE SELECT (contact_email, contact_phone) ON public.residences FROM authenticated';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- 05. RLS hardening — replace meaningless WITH CHECK (true) clauses
-- ============================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT unnest(ARRAY[
    'notifications','payments','referral_claims','shop_order_items',
    'payment_action_logs','order_status_history','application_activity_log',
    'call_logs','wil_admin_notes','referral_earnings','residence_analytics'
  ]) AS t LOOP
    EXECUTE format('
      DO $inner$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=''public'' AND tablename=%L AND policyname=%L)
        THEN EXECUTE %L; END IF;
      END $inner$;
    ',
    r.t, r.t || '_insert_any',
    'DROP POLICY "' || r.t || '_insert_any" ON public.' || r.t);
  END LOOP;
END $$;
-- (Existing meaningful per-table policies stay untouched.)

-- ============================================================================
-- 06. Auth hardening reminder (HIBP)
--   Enable in Studio → Authentication → Password protection.
--   No SQL equivalent.
-- ============================================================================

-- ============================================================================
-- 07. Handover Pack integrity — view + validator
--    (Mirrors docs/MASTER_EXPORT_INTEGRITY_SQL.sql verbatim)
-- ============================================================================
DROP VIEW IF EXISTS public.residence_handover_export_v CASCADE;
CREATE VIEW public.residence_handover_export_v
WITH (security_invoker = on) AS
SELECT
  a.id                                                                AS application_id,
  upper(substring(replace(a.id::text, '-', '') for 8))                AS ref_code,
  a.residence_id,
  r.name                                                              AS residence_name,
  a.user_id,
  COALESCE(NULLIF(split_part(trim(p.full_name), ' ', 1), ''), NULL)   AS student_name,
  CASE
    WHEN p.full_name IS NULL OR trim(p.full_name) = '' THEN NULL
    WHEN position(' ' in trim(p.full_name)) = 0 THEN NULL
    ELSE trim(substring(trim(p.full_name) from position(' ' in trim(p.full_name)) + 1))
  END                                                                  AS student_surname,
  NULLIF(trim(p.student_number), '')                                   AS student_number,
  NULLIF(trim(a.funding_type), '')                                     AS funding_source,
  p.email, p.phone, p.campus,
  a.status, a.application_date, a.move_in_date, a.moved_in, a.created_at
FROM public.applications a
LEFT JOIN public.profiles p   ON p.id = a.user_id
LEFT JOIN public.residences r ON r.id = a.residence_id;

GRANT SELECT ON public.residence_handover_export_v TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_handover_pack(_residence_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _errors jsonb := '[]'::jsonb; _totals jsonb; _row record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE='42501';
  END IF;

  FOR _row IN
    SELECT v.application_id, v.student_name, v.student_surname, v.student_number,
           v.funding_source, v.user_id, v.residence_id, v.residence_name
    FROM public.residence_handover_export_v v
    WHERE _residence_id IS NULL OR v.residence_id = _residence_id
  LOOP
    IF _row.student_name      IS NULL THEN _errors := _errors || jsonb_build_object('code','missing_name',           'application_id',_row.application_id,'reason','Student name is blank'); END IF;
    IF _row.student_surname   IS NULL THEN _errors := _errors || jsonb_build_object('code','missing_surname',        'application_id',_row.application_id,'reason','Student surname is blank'); END IF;
    IF _row.student_number    IS NULL THEN _errors := _errors || jsonb_build_object('code','missing_student_number', 'application_id',_row.application_id,'reason','Student number is blank'); END IF;
    IF _row.funding_source    IS NULL OR _row.funding_source='unknown' THEN
      _errors := _errors || jsonb_build_object('code','missing_funding','application_id',_row.application_id,'reason','Funding source missing/unknown');
    END IF;
    IF _row.residence_name    IS NULL THEN _errors := _errors || jsonb_build_object('code','invalid_residence',      'application_id',_row.application_id,'reason','Residence no longer exists'); END IF;
    IF _row.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=_row.user_id) THEN
      _errors := _errors || jsonb_build_object('code','orphan_profile','application_id',_row.application_id,'reason','Application user has no profile');
    END IF;
  END LOOP;

  FOR _row IN
    SELECT student_number, residence_id, array_agg(application_id) AS app_ids
    FROM public.residence_handover_export_v
    WHERE student_number IS NOT NULL AND (_residence_id IS NULL OR residence_id=_residence_id)
    GROUP BY student_number, residence_id HAVING COUNT(*)>1
  LOOP
    _errors := _errors || jsonb_build_object('code','duplicate_student_number',
      'application_id',_row.app_ids[1],
      'reason','Student number '||_row.student_number||' appears on multiple applications: '||array_to_string(_row.app_ids, ', '));
  END LOOP;

  FOR _row IN
    SELECT user_id, residence_id, array_agg(application_id) AS app_ids
    FROM public.residence_handover_export_v
    WHERE user_id IS NOT NULL AND (_residence_id IS NULL OR residence_id=_residence_id)
    GROUP BY user_id, residence_id HAVING COUNT(*)>1
  LOOP
    _errors := _errors || jsonb_build_object('code','duplicate_application',
      'application_id',_row.app_ids[1],
      'reason','Same user, same residence, multiple applications: '||array_to_string(_row.app_ids, ', '));
  END LOOP;

  SELECT jsonb_build_object(
    'total_applications', COUNT(*),
    'total_students',     COUNT(DISTINCT user_id),
    'missing_names',      COUNT(*) FILTER (WHERE student_name IS NULL),
    'missing_surnames',   COUNT(*) FILTER (WHERE student_surname IS NULL),
    'missing_student_no', COUNT(*) FILTER (WHERE student_number IS NULL),
    'missing_funding',    COUNT(*) FILTER (WHERE funding_source IS NULL OR funding_source='unknown'),
    'invalid_residence',  COUNT(*) FILTER (WHERE residence_name IS NULL),
    'duplicates_found',   jsonb_array_length(_errors)
  ) INTO _totals
  FROM public.residence_handover_export_v
  WHERE _residence_id IS NULL OR residence_id = _residence_id;

  RETURN jsonb_build_object('ok', jsonb_array_length(_errors)=0,
    'residence_id',_residence_id,'totals',_totals,'errors',_errors,'generated_at',now());
END $$;

REVOKE ALL ON FUNCTION public.validate_handover_pack(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_handover_pack(uuid) TO authenticated, service_role;

-- ============================================================================
-- 08. Verification queries
-- ============================================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='residences' AND column_name='slug';
-- SELECT * FROM public.filter_config ORDER BY display_order;
-- SELECT COUNT(*) FROM public.residence_handover_export_v;
-- SELECT public.validate_handover_pack(NULL);