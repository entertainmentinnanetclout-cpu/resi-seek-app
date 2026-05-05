
-- 1. Cart multi-source support
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'product';
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS hamper_id uuid;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS hamper_item_id uuid;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS unit_price numeric;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS title_snapshot text;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS image_snapshot text;
ALTER TABLE public.cart_items ALTER COLUMN product_id DROP NOT NULL;
DO $$ BEGIN
  ALTER TABLE public.cart_items ADD CONSTRAINT cart_item_source_chk CHECK (
    (item_type='product' AND product_id IS NOT NULL)
    OR (item_type='hamper' AND hamper_id IS NOT NULL)
    OR (item_type='hamper_item' AND hamper_item_id IS NOT NULL)
  );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN NULL; END $$;

-- 2. Delivery zones
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  base_fee numeric NOT NULL DEFAULT 0,
  free_threshold numeric,
  conditions text,
  is_active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY anyone_view_active_delivery_zones ON public.delivery_zones FOR SELECT USING (is_active = true OR has_role(auth.uid(),'admin'::app_role)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY admins_manage_delivery_zones ON public.delivery_zones FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Shop orders: delivery + referral
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS delivery_zone_id uuid;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS referral_credited boolean DEFAULT false;

-- 4. display_order on storefront tables
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS display_order int DEFAULT 0;
ALTER TABLE public.hampers ADD COLUMN IF NOT EXISTS display_order int DEFAULT 0;
ALTER TABLE public.hamper_items ADD COLUMN IF NOT EXISTS display_order int DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_products_display_order ON public.products(display_order);
CREATE INDEX IF NOT EXISTS idx_hampers_display_order ON public.hampers(display_order);
CREATE INDEX IF NOT EXISTS idx_hamper_items_display_order ON public.hamper_items(display_order);

-- 5. Hamper items become individually orderable
ALTER TABLE public.hamper_items ADD COLUMN IF NOT EXISTS is_orderable boolean NOT NULL DEFAULT true;
ALTER TABLE public.hamper_items ADD COLUMN IF NOT EXISTS price numeric;
ALTER TABLE public.hamper_items ADD COLUMN IF NOT EXISTS stock_quantity int DEFAULT 100;
-- Seed price from estimated_price where missing
UPDATE public.hamper_items SET price = COALESCE(price, estimated_price, 0) WHERE price IS NULL;

-- 6. Settings seed
INSERT INTO public.platform_settings(key, value, description)
VALUES ('referral_signup_bonus', '{"amount": 10}'::jsonb, 'Flat ZAR per referred signup')
ON CONFLICT (key) DO NOTHING;
INSERT INTO public.platform_settings(key, value, description)
VALUES ('referral_sale_percent', '{"percent": 5}'::jsonb, 'Percent of referred sale paid to referrer')
ON CONFLICT (key) DO NOTHING;

-- 7. Capture referral on sale
CREATE OR REPLACE FUNCTION public.capture_referral_sale(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ord RECORD;
  _ref_code text;
  _referrer uuid;
  _pct numeric;
  _amount numeric;
BEGIN
  SELECT id, user_id, total_amount, referral_code, referral_credited
    INTO _ord
  FROM public.shop_orders WHERE id = _order_id;

  IF _ord IS NULL OR _ord.referral_credited = true THEN RETURN; END IF;
  _ref_code := _ord.referral_code;
  IF _ref_code IS NULL OR _ref_code = '' THEN RETURN; END IF;

  SELECT user_id INTO _referrer FROM public.referral_codes WHERE code = _ref_code AND is_active = true;
  IF _referrer IS NULL OR _referrer = _ord.user_id THEN RETURN; END IF;

  SELECT (value->>'percent')::numeric INTO _pct FROM public.platform_settings WHERE key='referral_sale_percent';
  _amount := ROUND(COALESCE(_ord.total_amount,0) * COALESCE(_pct,5) / 100.0, 2);
  IF _amount <= 0 THEN RETURN; END IF;

  UPDATE public.referral_codes
     SET sale_count = COALESCE(sale_count,0) + 1,
         total_earned = COALESCE(total_earned,0) + _amount
   WHERE user_id = _referrer;

  INSERT INTO public.referral_earnings(referrer_user_id, referred_user_id, source_type, amount)
  VALUES (_referrer, _ord.user_id, 'sale', _amount);

  UPDATE public.shop_orders SET referral_credited = true WHERE id = _order_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.capture_referral_sale(uuid) TO authenticated;

-- 8. Seed delivery zones (idempotent)
INSERT INTO public.delivery_zones(name, description, base_fee, free_threshold, conditions, display_order)
SELECT 'TUT Soshanguve South Drop-off', 'Pick up at central campus drop-off point.', 0, NULL, 'Free pickup, available weekdays 09:00–16:00.', 1
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zones WHERE name='TUT Soshanguve South Drop-off');
INSERT INTO public.delivery_zones(name, description, base_fee, free_threshold, conditions, display_order)
SELECT 'TUT Pretoria Campus Drop-off', 'Arcadia campus drop-off point.', 0, NULL, 'Free pickup, available weekdays 09:00–16:00.', 2
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zones WHERE name='TUT Pretoria Campus Drop-off');
INSERT INTO public.delivery_zones(name, description, base_fee, free_threshold, conditions, display_order)
SELECT 'Local Residence Delivery', 'Delivery to listed student residences.', 35, 350, 'Free over R350. Delivered within 24–48 hours.', 3
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zones WHERE name='Local Residence Delivery');
INSERT INTO public.delivery_zones(name, description, base_fee, free_threshold, conditions, display_order)
SELECT 'National Courier', 'Door-to-door courier nationwide.', 99, 800, 'Free over R800. 2–4 working days.', 4
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zones WHERE name='National Courier');
