-- ============================================================
-- RESKONNECT PHASE 1A — MIGRATION PACK 2/3 (Commerce)
-- ============================================================

-- 1. STORES
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  store_description TEXT,
  store_logo_url TEXT,
  store_banner_url TEXT,
  contact_whatsapp TEXT,
  contact_email TEXT,
  campus TEXT,
  is_active BOOLEAN DEFAULT true,
  verified BOOLEAN DEFAULT false,
  total_sales INTEGER DEFAULT 0,
  rating NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. MARKETPLACE LISTINGS
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC NOT NULL,
  category TEXT NOT NULL,
  condition TEXT NOT NULL,
  images TEXT[] DEFAULT '{}' NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL,
  verified BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. MARKETPLACE ORDERS
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  total_price NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  buyer_notes TEXT,
  buyer_phone TEXT,
  delivery_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. STORE REVIEWS
CREATE TABLE IF NOT EXISTS public.store_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. CATALOG
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  image_url TEXT,
  parent_id UUID REFERENCES public.product_categories(id),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  compare_at_price NUMERIC,
  sku TEXT,
  brand TEXT,
  category_id UUID REFERENCES public.product_categories(id),
  images TEXT[],
  tags TEXT[],
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  is_landing_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  sku TEXT,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. CART
CREATE TABLE IF NOT EXISTS public.cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.cart(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'product',
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  hamper_id UUID,
  hamper_item_id UUID,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC,
  display_name TEXT,
  display_image TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. DELIVERY ZONES
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  campus TEXT,
  fee NUMERIC NOT NULL DEFAULT 0,
  free_threshold NUMERIC,
  estimated_days INTEGER DEFAULT 3,
  conditions TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. SHOP ORDERS
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  total_amount NUMERIC NOT NULL,
  delivery_zone_id UUID REFERENCES public.delivery_zones(id),
  delivery_fee NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'cod',
  payment_status TEXT DEFAULT 'pending',
  delivery_address TEXT,
  delivery_phone TEXT,
  notes TEXT,
  referral_code TEXT,
  referral_credited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'product',
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  hamper_id UUID,
  hamper_item_id UUID,
  store_id UUID REFERENCES public.stores(id) ON DELETE RESTRICT,
  display_name TEXT,
  display_image TEXT,
  quantity INTEGER DEFAULT 1 NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  payment_gateway TEXT,
  payment_status TEXT DEFAULT 'pending',
  transaction_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. EFT
CREATE TABLE IF NOT EXISTS public.eft_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  amount_rand NUMERIC NOT NULL,
  amount_cents INTEGER NOT NULL,
  bank_name TEXT,
  account_holder TEXT,
  account_number TEXT,
  branch_code TEXT,
  proof_path TEXT,
  proof_fingerprint TEXT,
  status TEXT DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  verified_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.shop_orders(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  action TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. HAMPERS
CREATE TABLE IF NOT EXISTS public.hampers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  image_url TEXT,
  category TEXT,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hamper_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  estimated_price NUMERIC,
  price NUMERIC,
  is_orderable BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hamper_bundle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hamper_id UUID NOT NULL REFERENCES public.hampers(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hamper_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_method TEXT DEFAULT 'cod',
  payment_status TEXT DEFAULT 'pending',
  delivery_address TEXT,
  delivery_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hamper_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.hamper_orders(id) ON DELETE CASCADE,
  hamper_id UUID NOT NULL REFERENCES public.hampers(id) ON DELETE RESTRICT,
  quantity INTEGER DEFAULT 1,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_hamper_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.hamper_items(id) ON DELETE CASCADE,
  preference TEXT DEFAULT 'want' NOT NULL,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- 11. DISCOUNTS
CREATE TABLE IF NOT EXISTS public.student_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  discount TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  how_to_claim TEXT,
  link TEXT,
  image_url TEXT,
  delivery_info TEXT,
  valid_until DATE,
  price NUMERIC,
  original_price NUMERIC,
  is_orderable BOOLEAN DEFAULT false,
  stock_quantity INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.discount_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discount_id UUID NOT NULL REFERENCES public.student_discounts(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1 NOT NULL,
  total_price NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  delivery_address TEXT,
  phone TEXT,
  notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. TRIGGERS
DROP TRIGGER IF EXISTS update_stores_updated_at ON public.stores;
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_marketplace_listings_updated_at ON public.marketplace_listings;
CREATE TRIGGER update_marketplace_listings_updated_at BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_marketplace_orders_updated_at ON public.marketplace_orders;
CREATE TRIGGER update_marketplace_orders_updated_at BEFORE UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_shop_orders_updated_at ON public.shop_orders;
CREATE TRIGGER update_shop_orders_updated_at BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_hamper_orders_updated_at ON public.hamper_orders;
CREATE TRIGGER update_hamper_orders_updated_at BEFORE UPDATE ON public.hamper_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_hampers_updated_at ON public.hampers;
CREATE TRIGGER update_hampers_updated_at BEFORE UPDATE ON public.hampers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_eft_payments_updated_at ON public.eft_payments;
CREATE TRIGGER update_eft_payments_updated_at BEFORE UPDATE ON public.eft_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. GRANTS
GRANT SELECT ON public.stores, public.marketplace_listings, public.store_reviews,
  public.product_categories, public.products, public.product_variants,
  public.hampers, public.hamper_items, public.hamper_bundle_items,
  public.student_discounts, public.delivery_zones TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_listings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eft_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_action_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_rate_limits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hampers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hamper_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hamper_bundle_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hamper_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hamper_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_hamper_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_discounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_orders TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 14. RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eft_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hampers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hamper_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hamper_bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hamper_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hamper_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_hamper_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_orders ENABLE ROW LEVEL SECURITY;

-- 15. POLICIES
-- Stores
DROP POLICY IF EXISTS p_stores_pub ON public.stores;
CREATE POLICY p_stores_pub ON public.stores FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS p_stores_owner_sel ON public.stores;
CREATE POLICY p_stores_owner_sel ON public.stores FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS p_stores_owner_ins ON public.stores;
CREATE POLICY p_stores_owner_ins ON public.stores FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS p_stores_owner_upd ON public.stores;
CREATE POLICY p_stores_owner_upd ON public.stores FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS p_stores_owner_del ON public.stores;
CREATE POLICY p_stores_owner_del ON public.stores FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS p_stores_admin ON public.stores;
CREATE POLICY p_stores_admin ON public.stores FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Marketplace listings
DROP POLICY IF EXISTS p_ml_pub ON public.marketplace_listings;
CREATE POLICY p_ml_pub ON public.marketplace_listings FOR SELECT
  USING ((status = 'active' AND verified = true) OR auth.uid() = user_id);
DROP POLICY IF EXISTS p_ml_ins ON public.marketplace_listings;
CREATE POLICY p_ml_ins ON public.marketplace_listings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS p_ml_upd ON public.marketplace_listings;
CREATE POLICY p_ml_upd ON public.marketplace_listings FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS p_ml_del ON public.marketplace_listings;
CREATE POLICY p_ml_del ON public.marketplace_listings FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS p_ml_admin ON public.marketplace_listings;
CREATE POLICY p_ml_admin ON public.marketplace_listings FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Marketplace orders
DROP POLICY IF EXISTS p_mo_buy_sel ON public.marketplace_orders;
CREATE POLICY p_mo_buy_sel ON public.marketplace_orders FOR SELECT USING (auth.uid() = buyer_id);
DROP POLICY IF EXISTS p_mo_sell_sel ON public.marketplace_orders;
CREATE POLICY p_mo_sell_sel ON public.marketplace_orders FOR SELECT USING (auth.uid() = seller_id);
DROP POLICY IF EXISTS p_mo_buy_ins ON public.marketplace_orders;
CREATE POLICY p_mo_buy_ins ON public.marketplace_orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
DROP POLICY IF EXISTS p_mo_sell_upd ON public.marketplace_orders;
CREATE POLICY p_mo_sell_upd ON public.marketplace_orders FOR UPDATE USING (auth.uid() = seller_id);
DROP POLICY IF EXISTS p_mo_admin ON public.marketplace_orders;
CREATE POLICY p_mo_admin ON public.marketplace_orders FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Store reviews
DROP POLICY IF EXISTS p_sr_pub ON public.store_reviews;
CREATE POLICY p_sr_pub ON public.store_reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS p_sr_ins ON public.store_reviews;
CREATE POLICY p_sr_ins ON public.store_reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
DROP POLICY IF EXISTS p_sr_upd ON public.store_reviews;
CREATE POLICY p_sr_upd ON public.store_reviews FOR UPDATE USING (auth.uid() = reviewer_id);
DROP POLICY IF EXISTS p_sr_del ON public.store_reviews;
CREATE POLICY p_sr_del ON public.store_reviews FOR DELETE USING (auth.uid() = reviewer_id);

-- Categories
DROP POLICY IF EXISTS p_pc_pub ON public.product_categories;
CREATE POLICY p_pc_pub ON public.product_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS p_pc_admin ON public.product_categories;
CREATE POLICY p_pc_admin ON public.product_categories FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Products
DROP POLICY IF EXISTS p_prod_pub ON public.products;
CREATE POLICY p_prod_pub ON public.products FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS p_prod_owner ON public.products;
CREATE POLICY p_prod_owner ON public.products FOR ALL
  USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.user_id = auth.uid()));
DROP POLICY IF EXISTS p_prod_admin ON public.products;
CREATE POLICY p_prod_admin ON public.products FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Variants
DROP POLICY IF EXISTS p_pv_pub ON public.product_variants;
CREATE POLICY p_pv_pub ON public.product_variants FOR SELECT USING (true);
DROP POLICY IF EXISTS p_pv_owner ON public.product_variants;
CREATE POLICY p_pv_owner ON public.product_variants FOR ALL
  USING (EXISTS (SELECT 1 FROM products p JOIN stores s ON s.id = p.store_id WHERE p.id = product_variants.product_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM products p JOIN stores s ON s.id = p.store_id WHERE p.id = product_variants.product_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS p_pv_admin ON public.product_variants;
CREATE POLICY p_pv_admin ON public.product_variants FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Cart
DROP POLICY IF EXISTS p_cart_owner ON public.cart;
CREATE POLICY p_cart_owner ON public.cart FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS p_cartitem_owner ON public.cart_items;
CREATE POLICY p_cartitem_owner ON public.cart_items FOR ALL
  USING (EXISTS (SELECT 1 FROM cart WHERE cart.id = cart_items.cart_id AND cart.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM cart WHERE cart.id = cart_items.cart_id AND cart.user_id = auth.uid()));

-- Delivery zones
DROP POLICY IF EXISTS p_dz_pub ON public.delivery_zones;
CREATE POLICY p_dz_pub ON public.delivery_zones FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS p_dz_admin ON public.delivery_zones;
CREATE POLICY p_dz_admin ON public.delivery_zones FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Shop orders
DROP POLICY IF EXISTS p_so_owner ON public.shop_orders;
CREATE POLICY p_so_owner ON public.shop_orders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS p_so_admin ON public.shop_orders;
CREATE POLICY p_so_admin ON public.shop_orders FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Shop order items
DROP POLICY IF EXISTS p_soi_owner ON public.shop_order_items;
CREATE POLICY p_soi_owner ON public.shop_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM shop_orders WHERE shop_orders.id = shop_order_items.order_id AND shop_orders.user_id = auth.uid()));
DROP POLICY IF EXISTS p_soi_seller ON public.shop_order_items;
CREATE POLICY p_soi_seller ON public.shop_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = shop_order_items.store_id AND stores.user_id = auth.uid()));
DROP POLICY IF EXISTS p_soi_sys_ins ON public.shop_order_items;
CREATE POLICY p_soi_sys_ins ON public.shop_order_items FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS p_soi_admin ON public.shop_order_items;
CREATE POLICY p_soi_admin ON public.shop_order_items FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Order status history
DROP POLICY IF EXISTS p_osh_owner ON public.order_status_history;
CREATE POLICY p_osh_owner ON public.order_status_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM shop_orders WHERE shop_orders.id = order_status_history.order_id AND shop_orders.user_id = auth.uid()));
DROP POLICY IF EXISTS p_osh_sys_ins ON public.order_status_history;
CREATE POLICY p_osh_sys_ins ON public.order_status_history FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS p_osh_admin ON public.order_status_history;
CREATE POLICY p_osh_admin ON public.order_status_history FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Payments
DROP POLICY IF EXISTS p_pay_owner ON public.payments;
CREATE POLICY p_pay_owner ON public.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM shop_orders WHERE shop_orders.id = payments.order_id AND shop_orders.user_id = auth.uid()));
DROP POLICY IF EXISTS p_pay_sys_ins ON public.payments;
CREATE POLICY p_pay_sys_ins ON public.payments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS p_pay_admin ON public.payments;
CREATE POLICY p_pay_admin ON public.payments FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- EFT
DROP POLICY IF EXISTS p_eft_owner ON public.eft_payments;
CREATE POLICY p_eft_owner ON public.eft_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS p_eft_admin ON public.eft_payments;
CREATE POLICY p_eft_admin ON public.eft_payments FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Payment logs/limits (system only + admin view)
DROP POLICY IF EXISTS p_pal_sys_ins ON public.payment_action_logs;
CREATE POLICY p_pal_sys_ins ON public.payment_action_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS p_pal_admin ON public.payment_action_logs;
CREATE POLICY p_pal_admin ON public.payment_action_logs FOR SELECT USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_prl_sys ON public.payment_rate_limits;
CREATE POLICY p_prl_sys ON public.payment_rate_limits FOR ALL USING (true) WITH CHECK (true);

-- Hampers
DROP POLICY IF EXISTS p_h_pub ON public.hampers;
CREATE POLICY p_h_pub ON public.hampers FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS p_h_admin ON public.hampers;
CREATE POLICY p_h_admin ON public.hampers FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_hi_pub ON public.hamper_items;
CREATE POLICY p_hi_pub ON public.hamper_items FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS p_hi_admin ON public.hamper_items;
CREATE POLICY p_hi_admin ON public.hamper_items FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_hbi_pub ON public.hamper_bundle_items;
CREATE POLICY p_hbi_pub ON public.hamper_bundle_items FOR SELECT USING (true);
DROP POLICY IF EXISTS p_hbi_admin ON public.hamper_bundle_items;
CREATE POLICY p_hbi_admin ON public.hamper_bundle_items FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_ho_owner ON public.hamper_orders;
CREATE POLICY p_ho_owner ON public.hamper_orders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS p_ho_admin ON public.hamper_orders;
CREATE POLICY p_ho_admin ON public.hamper_orders FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_hoi_owner ON public.hamper_order_items;
CREATE POLICY p_hoi_owner ON public.hamper_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM hamper_orders WHERE hamper_orders.id = hamper_order_items.order_id AND hamper_orders.user_id = auth.uid()));
DROP POLICY IF EXISTS p_hoi_sys_ins ON public.hamper_order_items;
CREATE POLICY p_hoi_sys_ins ON public.hamper_order_items FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS p_hoi_admin ON public.hamper_order_items;
CREATE POLICY p_hoi_admin ON public.hamper_order_items FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_shp_owner ON public.student_hamper_preferences;
CREATE POLICY p_shp_owner ON public.student_hamper_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS p_shp_admin ON public.student_hamper_preferences;
CREATE POLICY p_shp_admin ON public.student_hamper_preferences FOR SELECT USING (has_role(auth.uid(),'admin'));

-- Discounts
DROP POLICY IF EXISTS p_sd_pub ON public.student_discounts;
CREATE POLICY p_sd_pub ON public.student_discounts FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS p_sd_admin ON public.student_discounts;
CREATE POLICY p_sd_admin ON public.student_discounts FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS p_do_owner ON public.discount_orders;
CREATE POLICY p_do_owner ON public.discount_orders FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS p_do_owner_ins ON public.discount_orders;
CREATE POLICY p_do_owner_ins ON public.discount_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS p_do_admin ON public.discount_orders;
CREATE POLICY p_do_admin ON public.discount_orders FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 16. INDEXES
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_display_order ON public.products(display_order);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_user_id ON public.cart(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_user_id ON public.shop_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_order_id ON public.shop_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_store_id ON public.shop_order_items(store_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_eft_payments_user_id ON public.eft_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_eft_payments_order_id ON public.eft_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_hampers_is_active ON public.hampers(is_active);
CREATE INDEX IF NOT EXISTS idx_hamper_orders_user_id ON public.hamper_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_store_id ON public.marketplace_listings(store_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON public.marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer_id ON public.marketplace_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller_id ON public.marketplace_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_discount_orders_user_id ON public.discount_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON public.stores(user_id);

-- 17. SEED
INSERT INTO public.product_categories (name, slug, display_order) VALUES
  ('Electronics','electronics',1),
  ('Textbooks','textbooks',2),
  ('Furniture','furniture',3),
  ('Clothing','clothing',4),
  ('Food & Snacks','food-snacks',5),
  ('Stationery','stationery',6),
  ('Services','services',7)
ON CONFLICT (slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';