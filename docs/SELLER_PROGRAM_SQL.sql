-- ============================================================
-- SELLER PROGRAM, REFERRALS, DISCOUNT CODES & WEB PUSH
-- External Supabase (mefjzkhobkltlbmhusdh)
-- Idempotent. Run in SQL editor. Safe to re-run.
-- ============================================================

-- ---------------- 1. STORES: KYC + payout fields ----------------
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS kyc_status text DEFAULT 'not_submitted';
  -- 'not_submitted' | 'pending' | 'approved' | 'rejected'
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS kyc_reviewed_at timestamptz;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS kyc_reviewed_by uuid;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS kyc_rejection_reason text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS id_number text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS student_number text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS payout_method text;       -- 'bank' | 'ewallet'
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS payout_bank_name text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS payout_account_number text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS payout_account_holder text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS payout_branch_code text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS verification_doc_url text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- ---------------- 2. SELLER KYC AUDIT LOG ----------------
CREATE TABLE IF NOT EXISTS public.seller_kyc_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  action text NOT NULL,             -- 'submitted' | 'approved' | 'rejected' | 'resubmitted'
  notes text,
  actor_id uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.seller_kyc_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY admins_manage_kyc_log ON public.seller_kyc_log FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY sellers_view_own_kyc_log ON public.seller_kyc_log FOR SELECT USING (EXISTS (SELECT 1 FROM public.stores WHERE stores.id = seller_kyc_log.store_id AND stores.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY system_insert_kyc_log ON public.seller_kyc_log FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------- 3. REFERRAL / AFFILIATE PROGRAM ----------------
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  signup_count integer DEFAULT 0,
  sale_count integer DEFAULT 0,
  total_earned numeric(10,2) DEFAULT 0,
  total_paid numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY users_manage_own_referral_code ON public.referral_codes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY admins_manage_referral_codes ON public.referral_codes FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY anyone_lookup_active_referral_codes ON public.referral_codes FOR SELECT USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Earnings ledger (one row per signup or sale)
CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid,
  source_type text NOT NULL,        -- 'signup' | 'sale'
  source_id uuid,                   -- order_id when sale
  amount numeric(10,2) NOT NULL,
  status text DEFAULT 'available',  -- 'available' | 'paid' | 'cancelled'
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY users_view_own_referral_earnings ON public.referral_earnings FOR SELECT USING (auth.uid() = referrer_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY admins_manage_referral_earnings ON public.referral_earnings FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY system_insert_referral_earnings ON public.referral_earnings FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Track who referred whom (one row per referred user)
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL UNIQUE,
  code text NOT NULL,
  signup_credited boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY users_view_own_referrals ON public.referrals FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY admins_manage_referrals ON public.referrals FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY users_insert_own_referral ON public.referrals FOR INSERT WITH CHECK (auth.uid() = referred_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Settings: signup_bonus and sale_percentage configurable
INSERT INTO public.platform_settings (key, value, description)
VALUES ('referral_signup_bonus', '10'::jsonb, 'Flat ZAR bonus paid per new signup via referral')
ON CONFLICT (key) DO NOTHING;
INSERT INTO public.platform_settings (key, value, description)
VALUES ('referral_sale_percentage', '5'::jsonb, 'Percentage of order total paid to referrer per sale')
ON CONFLICT (key) DO NOTHING;

-- ---------------- 4. DISCOUNT CODES (admin global + seller per-store) ----------------
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  scope text NOT NULL DEFAULT 'global',    -- 'global' | 'store'
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  discount_type text NOT NULL DEFAULT 'percent',   -- 'percent' | 'amount'
  discount_value numeric(10,2) NOT NULL,
  min_order_amount numeric(10,2) DEFAULT 0,
  max_uses integer,
  used_count integer DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_discount_codes_store ON public.discount_codes(store_id) WHERE store_id IS NOT NULL;

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY anyone_view_active_discount_codes ON public.discount_codes FOR SELECT USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY admins_manage_all_discount_codes ON public.discount_codes FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY sellers_manage_store_discount_codes ON public.discount_codes FOR ALL USING (scope = 'store' AND EXISTS (SELECT 1 FROM public.stores WHERE stores.id = discount_codes.store_id AND stores.user_id = auth.uid())) WITH CHECK (scope = 'store' AND EXISTS (SELECT 1 FROM public.stores WHERE stores.id = discount_codes.store_id AND stores.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Order-level usage tracking (so we can refund/reverse)
CREATE TABLE IF NOT EXISTS public.discount_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount_off numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.discount_code_redemptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY users_view_own_redemptions ON public.discount_code_redemptions FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY admins_view_all_redemptions ON public.discount_code_redemptions FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY system_insert_redemptions ON public.discount_code_redemptions FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------- 5. WEB PUSH SUBSCRIPTIONS ----------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,                          -- nullable to allow anon device subs
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY users_manage_own_push_subs ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY admins_manage_all_push_subs ON public.push_subscriptions FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY system_insert_push_subs ON public.push_subscriptions FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------- 6. STORAGE BUCKETS ----------------
INSERT INTO storage.buckets (id, name, public) VALUES ('seller-kyc','seller-kyc',false)
  ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN CREATE POLICY users_upload_own_kyc ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'seller-kyc' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY users_view_own_kyc ON storage.objects FOR SELECT USING (bucket_id = 'seller-kyc' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(),'admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY users_update_own_kyc ON storage.objects FOR UPDATE USING (bucket_id = 'seller-kyc' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------- 7. RPC: generate referral code ----------------
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
RETURNS public.referral_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.referral_codes;
  v_code text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_row FROM public.referral_codes WHERE user_id = v_user;
  IF FOUND THEN RETURN v_row; END IF;

  v_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text,'-','') FROM 1 FOR 6));
  INSERT INTO public.referral_codes (user_id, code) VALUES (v_user, v_code) RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated;

-- ---------------- 8. RPC: validate discount code ----------------
CREATE OR REPLACE FUNCTION public.validate_discount_code(_code text, _store_id uuid DEFAULT NULL, _order_total numeric DEFAULT 0)
RETURNS TABLE (id uuid, discount_type text, discount_value numeric, amount_off numeric, error text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.discount_codes;
  v_off numeric := 0;
BEGIN
  SELECT * INTO c FROM public.discount_codes WHERE code = UPPER(_code) AND is_active = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::numeric, NULL::numeric, 'Code not found'::text; RETURN;
  END IF;
  IF c.starts_at IS NOT NULL AND now() < c.starts_at THEN
    RETURN QUERY SELECT c.id, c.discount_type, c.discount_value, NULL::numeric, 'Not yet active'::text; RETURN;
  END IF;
  IF c.expires_at IS NOT NULL AND now() > c.expires_at THEN
    RETURN QUERY SELECT c.id, c.discount_type, c.discount_value, NULL::numeric, 'Expired'::text; RETURN;
  END IF;
  IF c.max_uses IS NOT NULL AND c.used_count >= c.max_uses THEN
    RETURN QUERY SELECT c.id, c.discount_type, c.discount_value, NULL::numeric, 'Usage limit reached'::text; RETURN;
  END IF;
  IF _order_total < c.min_order_amount THEN
    RETURN QUERY SELECT c.id, c.discount_type, c.discount_value, NULL::numeric, ('Minimum order R'||c.min_order_amount)::text; RETURN;
  END IF;
  IF c.scope = 'store' AND (c.store_id IS DISTINCT FROM _store_id) THEN
    RETURN QUERY SELECT c.id, c.discount_type, c.discount_value, NULL::numeric, 'Code not valid for this store'::text; RETURN;
  END IF;

  v_off := CASE WHEN c.discount_type = 'percent'
                THEN ROUND(_order_total * c.discount_value / 100.0, 2)
                ELSE LEAST(c.discount_value, _order_total)
           END;
  RETURN QUERY SELECT c.id, c.discount_type, c.discount_value, v_off, NULL::text;
END;
$$;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(text, uuid, numeric) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';