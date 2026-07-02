-- ============================================================================
--  MASTER_GOD_SQL.sql — ResKonnect · Full UI ↔ Database Alignment
--  Target: External Supabase (mefjzkhobkltlbmhusdh)
--  Idempotent. Additive. Safe to rerun. Supersedes prior parity packs.
--  Run in the External SQL Editor as one script.
-- ============================================================================
BEGIN;

-- ============================================================================
-- 00  Preflight
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shared updated_at helper (safe to re-create)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================================
-- 01  Schema repair — columns/relaxations discovered during audit
-- ============================================================================

-- residences: audience model + slug
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='residences') THEN
    EXECUTE 'ALTER TABLE public.residences
      ADD COLUMN IF NOT EXISTS accepts_university boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS accepts_tvet       boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS accepts_private    boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS accepts_nsfas      boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS institution_tags   text[]  NOT NULL DEFAULT ''{}''::text[],
      ADD COLUMN IF NOT EXISTS slug               text';
  END IF;
END $$;

-- applications: funding_type shim (mirrors funding_source when present)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='applications')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='applications' AND column_name='funding_type') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='applications' AND column_name='funding_source') THEN
      EXECUTE 'ALTER TABLE public.applications ADD COLUMN funding_type text GENERATED ALWAYS AS (funding_source) STORED';
    ELSE
      EXECUTE 'ALTER TABLE public.applications ADD COLUMN funding_type text';
    END IF;
  END IF;
END $$;

-- filter_config: relax legacy NOT NULL "name"
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='filter_config' AND column_name='name') THEN
    EXECUTE 'ALTER TABLE public.filter_config ALTER COLUMN name DROP NOT NULL';
  END IF;
END $$;

-- hero_slides: ensure image_url has a placeholder default so seeds never break
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='hero_slides' AND column_name='image_url') THEN
    EXECUTE $q$ALTER TABLE public.hero_slides
      ALTER COLUMN image_url SET DEFAULT 'https://placehold.co/1920x1080/0a2540/ffffff?text=ResKonnect'$q$;
  END IF;
END $$;

-- ============================================================================
-- 02  Missing tables referenced by UI/edge functions
--      (Each block: CREATE → GRANT → ENABLE RLS → POLICY)
-- ============================================================================

-- 02.1  admin_alerts
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL DEFAULT 'info',
  source   text NOT NULL,
  title    text NOT NULL,
  message  text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_alerts TO authenticated;
GRANT ALL ON public.admin_alerts TO service_role;
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_alerts admin manage" ON public.admin_alerts;
CREATE POLICY "admin_alerts admin manage" ON public.admin_alerts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 02.2  system_events (audit trail)
CREATE TABLE IF NOT EXISTS public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_user_id uuid,
  target_table text,
  target_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Backfill missing columns if an older system_events table already existed.
ALTER TABLE public.system_events ADD COLUMN IF NOT EXISTS actor_user_id uuid;
ALTER TABLE public.system_events ADD COLUMN IF NOT EXISTS target_table  text;
ALTER TABLE public.system_events ADD COLUMN IF NOT EXISTS target_id     text;
ALTER TABLE public.system_events ADD COLUMN IF NOT EXISTS payload       jsonb NOT NULL DEFAULT '{}'::jsonb;
GRANT SELECT, INSERT ON public.system_events TO authenticated;
GRANT ALL ON public.system_events TO service_role;
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_events admin read" ON public.system_events;
DROP POLICY IF EXISTS "system_events insert self" ON public.system_events;
CREATE POLICY "system_events admin read" ON public.system_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "system_events insert self" ON public.system_events FOR INSERT
  WITH CHECK (actor_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 02.3  webhook_events
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhook_events admin read" ON public.webhook_events;
CREATE POLICY "webhook_events admin read" ON public.webhook_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 02.4  discount_codes (admin/seller-managed codes; discount_orders already exists)
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text,
  scope text NOT NULL DEFAULT 'global', -- 'global' | 'store'
  store_id uuid,
  percent_off numeric(5,2),
  amount_off numeric(12,2),
  starts_at timestamptz,
  ends_at   timestamptz,
  usage_limit int,
  used_count int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.discount_codes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated;
GRANT ALL ON public.discount_codes TO service_role;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "discount_codes public read active" ON public.discount_codes;
DROP POLICY IF EXISTS "discount_codes owner manage" ON public.discount_codes;
DROP POLICY IF EXISTS "discount_codes admin manage" ON public.discount_codes;
CREATE POLICY "discount_codes public read active" ON public.discount_codes FOR SELECT USING (is_active = true);
CREATE POLICY "discount_codes owner manage"  ON public.discount_codes FOR ALL
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "discount_codes admin manage"  ON public.discount_codes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS trg_discount_codes_updated ON public.discount_codes;
CREATE TRIGGER trg_discount_codes_updated BEFORE UPDATE ON public.discount_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 02.5  marketplace_banners
CREATE TABLE IF NOT EXISTS public.marketplace_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  cta_text text,
  cta_link text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.marketplace_banners TO authenticated;
GRANT ALL ON public.marketplace_banners TO service_role;
ALTER TABLE public.marketplace_banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "banners public read" ON public.marketplace_banners;
DROP POLICY IF EXISTS "banners admin manage" ON public.marketplace_banners;
CREATE POLICY "banners public read"  ON public.marketplace_banners FOR SELECT USING (is_active = true);
CREATE POLICY "banners admin manage" ON public.marketplace_banners FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS trg_banners_updated ON public.marketplace_banners;
CREATE TRIGGER trg_banners_updated BEFORE UPDATE ON public.marketplace_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 02.6  payment_proofs (upload table backing the payment-proofs bucket)
CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid,
  order_type text,
  storage_path text NOT NULL,
  amount numeric(12,2),
  reference text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payment_proofs TO authenticated;
GRANT ALL ON public.payment_proofs TO service_role;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_proofs owner rw" ON public.payment_proofs;
DROP POLICY IF EXISTS "payment_proofs admin all" ON public.payment_proofs;
CREATE POLICY "payment_proofs owner rw" ON public.payment_proofs FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "payment_proofs admin all" ON public.payment_proofs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS trg_payment_proofs_updated ON public.payment_proofs;
CREATE TRIGGER trg_payment_proofs_updated BEFORE UPDATE ON public.payment_proofs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 02.7  platform_revenue (aggregated ledger read by God-Mode)
CREATE TABLE IF NOT EXISTS public.platform_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,          -- 'commission' | 'referral_signup' | 'referral_sale' | 'subscription' | 'other'
  order_id uuid,
  store_id uuid,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_revenue TO service_role;
GRANT SELECT ON public.platform_revenue TO authenticated;
ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "revenue admin read" ON public.platform_revenue;
CREATE POLICY "revenue admin read" ON public.platform_revenue FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 02.8  seller_earnings (per-store earning entries)
CREATE TABLE IF NOT EXISTS public.seller_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  seller_user_id uuid NOT NULL,
  order_id uuid,
  order_type text,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Backfill columns if an older seller_earnings table already existed.
ALTER TABLE public.seller_earnings ADD COLUMN IF NOT EXISTS store_id          uuid;
ALTER TABLE public.seller_earnings ADD COLUMN IF NOT EXISTS seller_user_id    uuid;
ALTER TABLE public.seller_earnings ADD COLUMN IF NOT EXISTS order_id          uuid;
ALTER TABLE public.seller_earnings ADD COLUMN IF NOT EXISTS order_type        text;
ALTER TABLE public.seller_earnings ADD COLUMN IF NOT EXISTS gross_amount      numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.seller_earnings ADD COLUMN IF NOT EXISTS commission_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.seller_earnings ADD COLUMN IF NOT EXISTS net_amount        numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.seller_earnings ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'pending';
GRANT SELECT ON public.seller_earnings TO authenticated;
GRANT ALL ON public.seller_earnings TO service_role;
ALTER TABLE public.seller_earnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "earnings seller read" ON public.seller_earnings;
DROP POLICY IF EXISTS "earnings admin all"   ON public.seller_earnings;
CREATE POLICY "earnings seller read" ON public.seller_earnings FOR SELECT
  USING (seller_user_id = auth.uid());
CREATE POLICY "earnings admin all"   ON public.seller_earnings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS trg_earnings_updated ON public.seller_earnings;
CREATE TRIGGER trg_earnings_updated BEFORE UPDATE ON public.seller_earnings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 02.9  seller_kyc_log
CREATE TABLE IF NOT EXISTS public.seller_kyc_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store_id uuid,
  action  text NOT NULL,       -- 'submitted' | 'approved' | 'rejected' | 'resubmitted'
  notes   text,
  document_path text,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.seller_kyc_log TO authenticated;
GRANT ALL ON public.seller_kyc_log TO service_role;
ALTER TABLE public.seller_kyc_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kyc self read"   ON public.seller_kyc_log;
DROP POLICY IF EXISTS "kyc self insert" ON public.seller_kyc_log;
DROP POLICY IF EXISTS "kyc admin all"   ON public.seller_kyc_log;
CREATE POLICY "kyc self read"   ON public.seller_kyc_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "kyc self insert" ON public.seller_kyc_log FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "kyc admin all"   ON public.seller_kyc_log FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 03  Storage buckets (only ensure the ones the UI expects)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('documents',             'documents',             false),
  ('marketplace',           'marketplace',           true),
  ('admin-images',          'admin-images',          true),
  ('store-assets',          'store-assets',          true),
  ('profile-pictures',      'profile-pictures',      true),
  ('application-documents', 'application-documents', false),
  ('wil-documents',         'wil-documents',         false),
  ('product-images',        'product-images',        true),
  ('hamper-images',         'hamper-images',         true),
  ('landlord-documents',    'landlord-documents',    false),
  ('payment-proofs',        'payment-proofs',        false),
  ('seller-kyc',            'seller-kyc',            false)
ON CONFLICT (id) DO NOTHING;

-- Baseline object policies: owner scoped + admin override for the private buckets
DO $$
DECLARE b text;
BEGIN
  FOR b IN SELECT unnest(ARRAY['payment-proofs','seller-kyc','landlord-documents','application-documents','wil-documents','documents']) LOOP
    EXECUTE format($p$DROP POLICY IF EXISTS "%1$s owner rw" ON storage.objects$p$, b);
    EXECUTE format($p$DROP POLICY IF EXISTS "%1$s admin rw" ON storage.objects$p$, b);
    EXECUTE format($p$CREATE POLICY "%1$s owner rw" ON storage.objects
      FOR ALL TO authenticated
      USING (bucket_id = %2$L AND auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = %2$L AND auth.uid()::text = (storage.foldername(name))[1])$p$, b, b);
    EXECUTE format($p$CREATE POLICY "%1$s admin rw" ON storage.objects
      FOR ALL TO authenticated
      USING (bucket_id = %2$L AND public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (bucket_id = %2$L AND public.has_role(auth.uid(), 'admin'::app_role))$p$, b, b);
  END LOOP;
END $$;

-- ============================================================================
-- 04  Seeds — safe UPSERTs
-- ============================================================================

-- 04.1 platform_settings (only insert missing keys)
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('marketplace_paused',   jsonb_build_object('paused', true, 'label','Marketplace paused'), 'Toggle to hide marketplace publicly'),
  ('referral_signup_bonus',jsonb_build_object('amount', 15),   'ZAR bonus paid on new sign-up referral'),
  ('referral_sale_percent',jsonb_build_object('percent', 5),   'Percent commission paid on referred sale'),
  ('tut_2026_deadline',    jsonb_build_object('date','2025-09-30','label','TUT 2026 Applications close 30 September 2025'),
                           'TUT undergraduate application closing date'),
  ('nsfas_tvet_open',      jsonb_build_object('open', true, 'label','NSFAS TVET Trimester 3 applications open'),
                           'NSFAS TVET application window flag')
ON CONFLICT (key) DO NOTHING;

-- 04.2 filter_config defaults
INSERT INTO public.filter_config (key, label, filter_group, display_order, control_type, is_featured)
VALUES
  ('nsfas',     'NSFAS Accredited',  'accreditation', 10, 'toggle', true),
  ('furnished', 'Furnished',         'amenities',     20, 'toggle', false),
  ('wifi',      'WiFi Included',     'amenities',     30, 'toggle', false),
  ('parking',   'Parking',           'amenities',     40, 'toggle', false),
  ('singles',   'Singles Available', 'rooms',         50, 'toggle', false)
ON CONFLICT (key) DO NOTHING;

-- 04.3 hero_slides deadline slides (schema-matched)
INSERT INTO public.hero_slides (title, description, image_url, cta_text, cta_link, is_active, display_order, slide_location)
SELECT * FROM (VALUES
  ('TUT 2026 Applications','Closing 30 September 2025 — get your documents ready',
   'https://placehold.co/1920x1080/0a2540/ffffff?text=TUT+2026+Applications',
   'Prepare Now','/apply?target=tut', true, 10, 'landing'),
  ('NSFAS TVET Now Open','Trimester 3 applications are open for TVET students',
   'https://placehold.co/1920x1080/0a7d3b/ffffff?text=NSFAS+TVET+Open',
   'Apply Guide','/apply?target=nsfas_tvet', true, 11, 'landing')
) AS v(title, description, image_url, cta_text, cta_link, is_active, display_order, slide_location)
WHERE NOT EXISTS (SELECT 1 FROM public.hero_slides WHERE title = v.title);

COMMIT;

-- ============================================================================
-- 05  Verification (run these SELECTs; each should look sensible)
-- ============================================================================
-- Row counts on core UI-load tables
SELECT 'residences'         AS t, count(*) FROM public.residences
UNION ALL SELECT 'hero_slides',       count(*) FROM public.hero_slides
UNION ALL SELECT 'filter_config',     count(*) FROM public.filter_config
UNION ALL SELECT 'platform_settings', count(*) FROM public.platform_settings
UNION ALL SELECT 'stores',            count(*) FROM public.stores
UNION ALL SELECT 'products',          count(*) FROM public.products;

-- Required RPCs are present
SELECT proname FROM pg_proc
 WHERE pronamespace='public'::regnamespace
   AND proname IN ('has_role','get_user_staff_role','get_or_create_referral_code',
                   'validate_referral_code','capture_referral','capture_referral_sale',
                   'validate_handover_pack','enforce_marketplace_order_seller')
 ORDER BY proname;

-- Required buckets exist
SELECT id, public FROM storage.buckets
 WHERE id IN ('documents','marketplace','admin-images','store-assets','profile-pictures',
              'application-documents','wil-documents','product-images','hamper-images',
              'landlord-documents','payment-proofs','seller-kyc')
 ORDER BY id;

-- Newly-created tables reachable
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public'
   AND table_name IN ('admin_alerts','system_events','webhook_events','discount_codes',
                      'marketplace_banners','payment_proofs','platform_revenue',
                      'seller_earnings','seller_kyc_log')
 ORDER BY table_name;
