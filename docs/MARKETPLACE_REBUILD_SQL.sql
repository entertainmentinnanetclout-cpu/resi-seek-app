-- =====================================================
-- Marketplace Rebuild Phase 1 — idempotent SQL
-- Run in external Supabase SQL editor (mefjzkhobkltlbmhusdh)
-- Safe to re-run. Additive only — does not drop data.
-- =====================================================

-- ----------- STORES: branding + status fields -----------
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#3b82f6';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS return_policy text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS delivery_notes text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_open boolean DEFAULT true;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS founding_seller boolean DEFAULT false;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS stores_slug_unique ON public.stores(slug) WHERE slug IS NOT NULL;

-- ----------- PRODUCTS: moderation + AI fields -----------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'approved';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_quality_status text DEFAULT 'pending';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ai_enhanced boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS moderation_notes text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_percent numeric;

-- ----------- SHOP_ORDERS: commission + delivery -----------
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS commission_rate numeric DEFAULT 0.03;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS commission_amount numeric DEFAULT 0;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending';
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS assigned_runner_id uuid;

-- ----------- CAMPAIGNS table -----------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  status text DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY admins_manage_campaigns ON public.campaigns FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY anyone_view_active_campaigns ON public.campaigns FOR SELECT USING (status = 'active');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------- SELLER PAYOUTS -----------
CREATE TABLE IF NOT EXISTS public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY admins_manage_payouts ON public.seller_payouts FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY sellers_view_own_payouts ON public.seller_payouts FOR SELECT USING (seller_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------- MARKETPLACE SETTINGS -----------
CREATE TABLE IF NOT EXISTS public.marketplace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.marketplace_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY admins_manage_marketplace_settings ON public.marketplace_settings FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY anyone_view_marketplace_settings ON public.marketplace_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------- MARKETPLACE BANNERS (per-category & hero) -----------
CREATE TABLE IF NOT EXISTS public.marketplace_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text NOT NULL,
  cta_text text,
  cta_link text,
  placement text NOT NULL DEFAULT 'hero', -- 'hero' | 'category' | 'campaign'
  category_slug text,                      -- when placement = 'category'
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.marketplace_banners ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY admins_manage_marketplace_banners ON public.marketplace_banners FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY anyone_view_active_marketplace_banners ON public.marketplace_banners FOR SELECT USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_marketplace_banners_placement ON public.marketplace_banners(placement, is_active, display_order);

-- ----------- Storage buckets (additive) -----------
INSERT INTO storage.buckets (id, name, public) VALUES ('store-banners','store-banners',true)
  ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-assets','campaign-assets',true)
  ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN CREATE POLICY anyone_view_store_banners ON storage.objects FOR SELECT USING (bucket_id = 'store-banners');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY users_upload_own_store_banners ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'store-banners' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY users_update_own_store_banners ON storage.objects FOR UPDATE USING (bucket_id = 'store-banners' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY anyone_view_campaign_assets ON storage.objects FOR SELECT USING (bucket_id = 'campaign-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY admins_upload_campaign_assets ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'campaign-assets' AND has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';