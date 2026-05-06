
-- ===== Referral & Web Push backbone (idempotent) =====================

-- 1. referral_codes
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  signup_count integer NOT NULL DEFAULT 0,
  sale_count integer NOT NULL DEFAULT 0,
  total_earned numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY referral_codes_owner_all ON public.referral_codes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY referral_codes_admin_all ON public.referral_codes
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY referral_codes_public_lookup ON public.referral_codes
  FOR SELECT USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. referral_earnings ledger
CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type IN ('signup','sale')),
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available',
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_referrer ON public.referral_earnings(referrer_user_id);
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY referral_earnings_owner_select ON public.referral_earnings
  FOR SELECT USING (auth.uid() = referrer_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY referral_earnings_admin_all ON public.referral_earnings
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY push_subscriptions_owner_all ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY push_subscriptions_admin_select ON public.push_subscriptions
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. get_or_create_referral_code helper
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
RETURNS public.referral_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.referral_codes;
  _new_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _row FROM public.referral_codes WHERE user_id = auth.uid();
  IF FOUND THEN
    RETURN _row;
  END IF;

  _new_code := 'RK' || UPPER(SUBSTRING(REPLACE(auth.uid()::text, '-', '') FROM 1 FOR 6));
  INSERT INTO public.referral_codes(user_id, code, is_active)
  VALUES (auth.uid(), _new_code, true)
  ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated;
