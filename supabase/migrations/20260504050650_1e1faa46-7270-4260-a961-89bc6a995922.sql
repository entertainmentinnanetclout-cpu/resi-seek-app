-- ===== Marketplace control & seller program ===========================
-- Idempotent. Safe to re-run.

-- 1. Platform settings defaults
INSERT INTO public.platform_settings(key, value, description)
VALUES
  ('referral_signup_bonus', '{"amount": 10}'::jsonb, 'Flat ZAR per referred signup'),
  ('referral_sale_percent', '{"percent": 5}'::jsonb, 'Percent of sale paid to referrer')
ON CONFLICT (key) DO NOTHING;

-- 2. shop_order_items table (admin order-on-behalf needs this)
CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  store_id uuid,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE public.shop_order_items
    ADD CONSTRAINT fk_shop_order_items_order
    FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY admins_manage_shop_order_items ON public.shop_order_items
    FOR ALL USING (has_role(auth.uid(),'admin'))
    WITH CHECK (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY users_view_own_shop_order_items ON public.shop_order_items
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.shop_orders so
              WHERE so.id = shop_order_items.order_id AND so.user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Hampers category
INSERT INTO public.product_categories(name, slug, display_order)
SELECT 'Hampers', 'hampers', 99
WHERE NOT EXISTS (SELECT 1 FROM public.product_categories WHERE slug = 'hampers');

-- 4. Re-assert admin moderation policies
DO $$ BEGIN
  CREATE POLICY admins_delete_any_product ON public.products
    FOR DELETE USING (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY admins_select_all_products ON public.products
    FOR SELECT USING (has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Capture-referral RPC
CREATE OR REPLACE FUNCTION public.capture_referral(_code text, _referred uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ref uuid;
  _bonus numeric;
BEGIN
  SELECT user_id INTO _ref
    FROM public.referral_codes
   WHERE code = _code AND is_active = true;

  IF _ref IS NULL OR _ref = _referred THEN
    RETURN;
  END IF;

  SELECT (value->>'amount')::numeric INTO _bonus
    FROM public.platform_settings
   WHERE key = 'referral_signup_bonus';

  UPDATE public.referral_codes
     SET signup_count = signup_count + 1,
         total_earned = total_earned + COALESCE(_bonus, 0)
   WHERE user_id = _ref;

  INSERT INTO public.referral_earnings(referrer_user_id, referred_user_id, source_type, amount)
  VALUES (_ref, _referred, 'signup', COALESCE(_bonus, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.capture_referral(text, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
