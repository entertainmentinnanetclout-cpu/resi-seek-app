-- =====================================================================
-- ADMIN_MASTER_SQL.sql — Admin-console-only master pack (rerunnable)
-- Target: External Supabase (mefjzkhobkltlbmhusdh)
-- Independent of MASTER_GOD_SQL.sql. Safe to re-run any time.
-- Sections: 01 FK cleanup · 02 Column shims · 03 Admin tables ·
--           04 Admin RPCs · 05 RLS admin overrides · 06 Storage ·
--           07 Verification block
-- =====================================================================

-- Guard: needs has_role() and app_role enum from MASTER_GOD_SQL.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='has_role') THEN
    RAISE EXCEPTION 'has_role() missing. Run docs/MASTER_GOD_SQL.sql first.';
  END IF;
END $$;

-- =====================================================================
-- 01 · FK / embed cleanup
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'residence_portal_accounts_residence_id_fkey'
      AND conrelid = 'public.residence_portal_accounts'::regclass
  ) AND EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_portal_accounts_residence'
      AND conrelid = 'public.residence_portal_accounts'::regclass
  ) THEN
    ALTER TABLE public.residence_portal_accounts
      DROP CONSTRAINT residence_portal_accounts_residence_id_fkey;
  END IF;
END $$;

-- =====================================================================
-- 02 · Column shims (deployed UI reads these)
-- =====================================================================
ALTER TABLE public.application_messages
  ADD COLUMN IF NOT EXISTS body TEXT;
UPDATE public.application_messages
   SET body = message
 WHERE body IS NULL AND message IS NOT NULL;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS funding_type TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='applications' AND column_name='funding_source'
  ) THEN
    EXECUTE 'UPDATE public.applications
               SET funding_type = funding_source
             WHERE funding_type IS NULL AND funding_source IS NOT NULL';
  END IF;
END $$;

ALTER TABLE public.hero_slides
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS cta_label TEXT,
  ADD COLUMN IF NOT EXISTS cta_url TEXT;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- =====================================================================
-- 03 · Admin-only tables (idempotent)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  actor_user_id UUID,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_type TEXT,
  status TEXT DEFAULT 'received',
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  action TEXT NOT NULL,
  actor_user_id UUID,
  detail JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reference TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seller_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id UUID NOT NULL,
  store_id UUID,
  order_id UUID,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seller_kyc_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  reviewer_user_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID,
  agent_user_id UUID,
  outcome TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  body TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.filter_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  label TEXT,
  value JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Grants + RLS + admin-only policies for every admin table
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'admin_alerts','system_events','webhook_events','payment_action_logs',
    'platform_revenue','seller_earnings','seller_kyc_log','call_logs',
    'whatsapp_templates','filter_config'
  ]) LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin_all_%s" ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY "admin_all_%s" ON public.%I
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin'))
      WITH CHECK (public.has_role(auth.uid(),'admin'))$p$, t, t);
  END LOOP;
END $$;

-- Public read for whatsapp_templates + filter_config (admin UI reads them widely)
ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.filter_config      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
DROP POLICY IF EXISTS "public_read_whatsapp_templates" ON public.whatsapp_templates;
CREATE POLICY "public_read_whatsapp_templates" ON public.whatsapp_templates
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "public_read_filter_config" ON public.filter_config;
CREATE POLICY "public_read_filter_config" ON public.filter_config
  FOR SELECT USING (is_active = true);
GRANT SELECT ON public.filter_config TO anon;

-- =====================================================================
-- 04 · Admin RPCs
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_dashboard_counts()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object(
    'users',           (SELECT COUNT(*) FROM public.profiles),
    'residences',      (SELECT COUNT(*) FROM public.residences),
    'applications',    (SELECT COUNT(*) FROM public.applications),
    'apps_pending',    (SELECT COUNT(*) FROM public.applications WHERE status IN ('pending','submitted','under_review')),
    'apps_approved',   (SELECT COUNT(*) FROM public.applications WHERE status = 'approved'),
    'stores',          (SELECT COUNT(*) FROM public.stores),
    'stores_pending',  (SELECT COUNT(*) FROM public.stores WHERE COALESCE(status,'pending')='pending'),
    'listings',        (SELECT COUNT(*) FROM public.marketplace_listings),
    'listings_pending',(SELECT COUNT(*) FROM public.marketplace_listings WHERE COALESCE(status,'pending')='pending'),
    'orders',          (SELECT COUNT(*) FROM public.shop_orders),
    'revenue_mtd',     (SELECT COALESCE(SUM(amount),0) FROM public.platform_revenue WHERE created_at >= date_trunc('month', now())),
    'generated_at',    now()
  ) INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_counts() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_recent_activity(_limit int DEFAULT 20)
RETURNS TABLE(kind TEXT, id UUID, label TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    (SELECT 'application'::text, a.id, COALESCE(a.status,'submitted'), a.created_at
       FROM public.applications a ORDER BY a.created_at DESC LIMIT _limit)
    UNION ALL
    (SELECT 'order'::text, o.id, COALESCE(o.status,'new'), o.created_at
       FROM public.shop_orders o ORDER BY o.created_at DESC LIMIT _limit)
    UNION ALL
    (SELECT 'listing'::text, l.id, COALESCE(l.title,'listing'), l.created_at
       FROM public.marketplace_listings l ORDER BY l.created_at DESC LIMIT _limit);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_recent_activity(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_listing(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE='42501';
  END IF;
  DELETE FROM public.marketplace_listings WHERE id = _id;
  INSERT INTO public.system_events(event_type, actor_user_id, payload)
  VALUES ('listing.deleted', auth.uid(), jsonb_build_object('listing_id', _id));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_listing(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_toggle_store_verified(_id uuid, _v boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE='42501';
  END IF;
  UPDATE public.stores
     SET is_verified = _v,
         status = CASE WHEN _v THEN 'approved' ELSE 'pending' END
   WHERE id = _id;
  INSERT INTO public.system_events(event_type, actor_user_id, payload)
  VALUES ('store.verified.toggled', auth.uid(), jsonb_build_object('store_id', _id, 'verified', _v));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_toggle_store_verified(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_application_status(_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE='42501';
  END IF;
  UPDATE public.applications SET status = _status WHERE id = _id;
  INSERT INTO public.application_activity_log(application_id, actor_user_id, action, detail)
  VALUES (_id, auth.uid(), 'status.changed', jsonb_build_object('status', _status, 'note', _note))
  ON CONFLICT DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_set_application_status(uuid, text, text) TO authenticated;

-- =====================================================================
-- 05 · RLS admin-override policies (so admin lists never return 0)
-- =====================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'stores','products','marketplace_listings','shop_orders','payment_proofs',
    'discount_orders','hamper_orders','landlord_applications','wil_applications',
    'applications','application_documents','application_messages','residences',
    'referral_codes','referral_earnings','profiles'
  ]) LOOP
    -- Skip tables that don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin_override_all_%s" ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY "admin_override_all_%s" ON public.%I
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin'))
      WITH CHECK (public.has_role(auth.uid(),'admin'))$p$, t, t);
  END LOOP;
END $$;

-- =====================================================================
-- 06 · Storage — admin override on sensitive buckets
-- =====================================================================
DO $$
DECLARE b TEXT;
BEGIN
  FOR b IN SELECT unnest(ARRAY[
    'payment-proofs','seller-kyc','landlord-documents',
    'wil-documents','application-documents','documents'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin_read_%s" ON storage.objects', b);
    EXECUTE format($p$CREATE POLICY "admin_read_%s" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = %L AND public.has_role(auth.uid(),'admin'))$p$, b, b);
    EXECUTE format('DROP POLICY IF EXISTS "admin_write_%s" ON storage.objects', b);
    EXECUTE format($p$CREATE POLICY "admin_write_%s" ON storage.objects
      FOR ALL TO authenticated
      USING (bucket_id = %L AND public.has_role(auth.uid(),'admin'))
      WITH CHECK (bucket_id = %L AND public.has_role(auth.uid(),'admin'))$p$, b, b, b);
  END LOOP;
END $$;

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- 07 · Verification block — run and inspect
-- =====================================================================
-- 7a duplicate FK count (must be 0)
SELECT COUNT(*) AS duplicate_portal_fks
  FROM pg_constraint
 WHERE conrelid = 'public.residence_portal_accounts'::regclass
   AND contype = 'f'
   AND conname = 'residence_portal_accounts_residence_id_fkey';

-- 7b required admin tables present (must be 10)
SELECT COUNT(*) AS admin_tables_present
  FROM information_schema.tables
 WHERE table_schema='public'
   AND table_name IN ('admin_alerts','system_events','webhook_events',
     'payment_action_logs','platform_revenue','seller_earnings',
     'seller_kyc_log','call_logs','whatsapp_templates','filter_config');

-- 7c column shims present (must be 7)
SELECT COUNT(*) AS shim_columns_present FROM information_schema.columns
 WHERE (table_name,column_name) IN (
   ('application_messages','body'),
   ('applications','funding_type'),
   ('hero_slides','subtitle'),
   ('hero_slides','cta_label'),
   ('hero_slides','cta_url'),
   ('stores','status'),
   ('marketplace_listings','status')
 );

-- 7d admin override policies count (should be >= 15)
SELECT COUNT(*) AS admin_override_policies
  FROM pg_policies
 WHERE schemaname='public' AND policyname LIKE 'admin_override_all_%';

-- 7e sample RPC call (run as admin user — otherwise raises 42501)
-- SELECT public.admin_dashboard_counts();