-- ============================================================
-- MARKETPLACE_FIX.sql — Full Idempotent Commerce Schema
-- Run on external Supabase (mefjzkhobkltlbmhusdh)
-- Safe to rerun. Last updated: 2026-03-26
-- ============================================================

-- ============================================================
-- 1. STORES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
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

DO $$ BEGIN ALTER TABLE public.stores ADD COLUMN store_logo_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.stores ADD COLUMN store_banner_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.stores ADD COLUMN contact_whatsapp TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.stores ADD COLUMN contact_email TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.stores ADD COLUMN campus TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.stores ADD COLUMN verified BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.stores ADD COLUMN total_sales INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.stores ADD COLUMN rating NUMERIC DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_view_all_stores" ON public.stores;
CREATE POLICY "admins_view_all_stores" ON public.stores FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_update_all_stores" ON public.stores;
CREATE POLICY "admins_update_all_stores" ON public.stores FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_delete_stores" ON public.stores;
CREATE POLICY "admins_delete_stores" ON public.stores FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "users_create_own_store" ON public.stores;
CREATE POLICY "users_create_own_store" ON public.stores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_view_own_store" ON public.stores;
CREATE POLICY "users_view_own_store" ON public.stores FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_store" ON public.stores;
CREATE POLICY "users_update_own_store" ON public.stores FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_store" ON public.stores;
CREATE POLICY "users_delete_own_store" ON public.stores FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "anyone_view_active_stores" ON public.stores;
CREATE POLICY "anyone_view_active_stores" ON public.stores FOR SELECT USING (is_active = true);

-- ============================================================
-- 2. PRODUCT CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id UUID REFERENCES public.product_categories(id),
  display_order INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN ALTER TABLE public.product_categories ADD COLUMN slug TEXT NOT NULL DEFAULT ''; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.product_categories ADD COLUMN display_order INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.product_categories ADD COLUMN image_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.product_categories ADD COLUMN parent_id UUID REFERENCES public.product_categories(id); EXCEPTION WHEN duplicate_column THEN NULL; END $$;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_categories" ON public.product_categories;
CREATE POLICY "admins_manage_categories" ON public.product_categories FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "anyone_view_categories" ON public.product_categories;
CREATE POLICY "anyone_view_categories" ON public.product_categories FOR SELECT USING (true);

-- Seed categories
INSERT INTO public.product_categories (name, slug, display_order) VALUES
  ('Electronics', 'electronics', 1),
  ('Stationery', 'stationery', 2),
  ('Food & Snacks', 'food-snacks', 3),
  ('Fashion', 'fashion', 4),
  ('Toiletries', 'toiletries', 5),
  ('Room Essentials', 'room-essentials', 6),
  ('Books & Notes', 'books-notes', 7),
  ('Services', 'services', 8)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  compare_at_price NUMERIC,
  category_id UUID,
  images TEXT[],
  stock_quantity INTEGER DEFAULT 0,
  sku TEXT,
  tags TEXT[],
  brand TEXT,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN ALTER TABLE public.products ADD COLUMN compare_at_price NUMERIC; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD COLUMN category_id UUID; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD COLUMN images TEXT[]; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD COLUMN stock_quantity INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD COLUMN sku TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD COLUMN tags TEXT[]; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD COLUMN brand TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD COLUMN is_active BOOLEAN DEFAULT true; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD COLUMN is_featured BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- FK: products -> stores
DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT fk_products_store FOREIGN KEY (store_id) REFERENCES public.stores(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FK: products -> product_categories
DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES public.product_categories(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_all_products" ON public.products;
CREATE POLICY "admins_manage_all_products" ON public.products FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "sellers_manage_own_products" ON public.products;
CREATE POLICY "sellers_manage_own_products" ON public.products FOR ALL
  USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.user_id = auth.uid()));

DROP POLICY IF EXISTS "anyone_view_active_products" ON public.products;
CREATE POLICY "anyone_view_active_products" ON public.products FOR SELECT USING (is_active = true);

-- ============================================================
-- 4. PRODUCT VARIANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  variant_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  sku TEXT,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.product_variants ADD CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_variants" ON public.product_variants;
CREATE POLICY "admins_manage_variants" ON public.product_variants FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "sellers_manage_own_variants" ON public.product_variants;
CREATE POLICY "sellers_manage_own_variants" ON public.product_variants FOR ALL
  USING (EXISTS (SELECT 1 FROM products JOIN stores ON stores.id = products.store_id WHERE products.id = product_variants.product_id AND stores.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM products JOIN stores ON stores.id = products.store_id WHERE products.id = product_variants.product_id AND stores.user_id = auth.uid()));

DROP POLICY IF EXISTS "anyone_view_variants" ON public.product_variants;
CREATE POLICY "anyone_view_variants" ON public.product_variants FOR SELECT USING (true);

-- ============================================================
-- 5. CART
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.cart ADD CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_cart" ON public.cart;
CREATE POLICY "users_manage_own_cart" ON public.cart FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 6. CART ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL,
  product_id UUID NOT NULL,
  variant_id UUID,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN ALTER TABLE public.cart_items ADD CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES public.cart(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cart_items ADD CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES public.products(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cart_items ADD CONSTRAINT fk_cart_items_variant FOREIGN KEY (variant_id) REFERENCES public.product_variants(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_cart_items" ON public.cart_items;
CREATE POLICY "users_manage_own_cart_items" ON public.cart_items FOR ALL
  USING (EXISTS (SELECT 1 FROM cart WHERE cart.id = cart_items.cart_id AND cart.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM cart WHERE cart.id = cart_items.cart_id AND cart.user_id = auth.uid()));

-- ============================================================
-- 7. SHOP ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'cod',
  payment_status TEXT DEFAULT 'pending',
  delivery_address TEXT,
  delivery_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN ALTER TABLE public.shop_orders ADD COLUMN notes TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.shop_orders ADD CONSTRAINT fk_shop_orders_user FOREIGN KEY (user_id) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_all_shop_orders" ON public.shop_orders;
CREATE POLICY "admins_manage_all_shop_orders" ON public.shop_orders FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "users_manage_own_shop_orders" ON public.shop_orders;
CREATE POLICY "users_manage_own_shop_orders" ON public.shop_orders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 8. SHOP ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,
  variant_id UUID,
  store_id UUID NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN ALTER TABLE public.shop_order_items ADD CONSTRAINT fk_shop_order_items_order FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_order_items ADD CONSTRAINT fk_shop_order_items_product FOREIGN KEY (product_id) REFERENCES public.products(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_order_items ADD CONSTRAINT fk_shop_order_items_store FOREIGN KEY (store_id) REFERENCES public.stores(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_all_shop_order_items" ON public.shop_order_items;
CREATE POLICY "admins_manage_all_shop_order_items" ON public.shop_order_items FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "users_view_own_shop_order_items" ON public.shop_order_items;
CREATE POLICY "users_view_own_shop_order_items" ON public.shop_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM shop_orders WHERE shop_orders.id = shop_order_items.order_id AND shop_orders.user_id = auth.uid()));

DROP POLICY IF EXISTS "sellers_view_their_order_items" ON public.shop_order_items;
CREATE POLICY "sellers_view_their_order_items" ON public.shop_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = shop_order_items.store_id AND stores.user_id = auth.uid()));

DROP POLICY IF EXISTS "system_insert_shop_order_items" ON public.shop_order_items;
CREATE POLICY "system_insert_shop_order_items" ON public.shop_order_items FOR INSERT WITH CHECK (true);

-- ============================================================
-- 9. ORDER STATUS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN ALTER TABLE public.order_status_history ADD CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_all_order_history" ON public.order_status_history;
CREATE POLICY "admins_manage_all_order_history" ON public.order_status_history FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "system_insert_order_history" ON public.order_status_history;
CREATE POLICY "system_insert_order_history" ON public.order_status_history FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "users_view_own_order_history" ON public.order_status_history;
CREATE POLICY "users_view_own_order_history" ON public.order_status_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM shop_orders WHERE shop_orders.id = order_status_history.order_id AND shop_orders.user_id = auth.uid()));

-- ============================================================
-- 10. PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  payment_gateway TEXT,
  payment_status TEXT DEFAULT 'pending',
  transaction_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN ALTER TABLE public.payments ADD CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES public.shop_orders(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_all_payments" ON public.payments;
CREATE POLICY "admins_manage_all_payments" ON public.payments FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "system_insert_payments" ON public.payments;
CREATE POLICY "system_insert_payments" ON public.payments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "users_view_own_payments" ON public.payments;
CREATE POLICY "users_view_own_payments" ON public.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM shop_orders WHERE shop_orders.id = payments.order_id AND shop_orders.user_id = auth.uid()));

-- ============================================================
-- 11. HAMPERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hampers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  image_url TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.hampers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_hampers" ON public.hampers;
CREATE POLICY "admins_manage_hampers" ON public.hampers FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "anyone_view_active_hampers" ON public.hampers;
CREATE POLICY "anyone_view_active_hampers" ON public.hampers FOR SELECT USING (is_active = true);

-- ============================================================
-- 12. HAMPER BUNDLE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hamper_bundle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hamper_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN ALTER TABLE public.hamper_bundle_items ADD CONSTRAINT fk_hamper_bundle_items_hamper FOREIGN KEY (hamper_id) REFERENCES public.hampers(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.hamper_bundle_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_hamper_bundle_items" ON public.hamper_bundle_items;
CREATE POLICY "admins_manage_hamper_bundle_items" ON public.hamper_bundle_items FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "anyone_view_hamper_bundle_items" ON public.hamper_bundle_items;
CREATE POLICY "anyone_view_hamper_bundle_items" ON public.hamper_bundle_items FOR SELECT USING (true);

-- ============================================================
-- 13. HAMPER ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hamper_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
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

DO $$ BEGIN ALTER TABLE public.hamper_orders ADD CONSTRAINT fk_hamper_orders_user FOREIGN KEY (user_id) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.hamper_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_all_hamper_orders" ON public.hamper_orders;
CREATE POLICY "admins_manage_all_hamper_orders" ON public.hamper_orders FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "users_manage_own_hamper_orders" ON public.hamper_orders;
CREATE POLICY "users_manage_own_hamper_orders" ON public.hamper_orders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 14. HAMPER ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hamper_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  hamper_id UUID NOT NULL,
  quantity INTEGER DEFAULT 1,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN ALTER TABLE public.hamper_order_items ADD CONSTRAINT fk_hamper_order_items_order FOREIGN KEY (order_id) REFERENCES public.hamper_orders(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.hamper_order_items ADD CONSTRAINT fk_hamper_order_items_hamper FOREIGN KEY (hamper_id) REFERENCES public.hampers(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.hamper_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_all_hamper_order_items" ON public.hamper_order_items;
CREATE POLICY "admins_manage_all_hamper_order_items" ON public.hamper_order_items FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "system_insert_hamper_order_items" ON public.hamper_order_items;
CREATE POLICY "system_insert_hamper_order_items" ON public.hamper_order_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "users_view_own_hamper_order_items" ON public.hamper_order_items;
CREATE POLICY "users_view_own_hamper_order_items" ON public.hamper_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM hamper_orders WHERE hamper_orders.id = hamper_order_items.order_id AND hamper_orders.user_id = auth.uid()));

-- ============================================================
-- 15. STORE REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.store_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  reviewer_id UUID NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN ALTER TABLE public.store_reviews ADD CONSTRAINT fk_store_reviews_store FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_view_store_reviews" ON public.store_reviews;
CREATE POLICY "anyone_view_store_reviews" ON public.store_reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "auth_create_store_reviews" ON public.store_reviews;
CREATE POLICY "auth_create_store_reviews" ON public.store_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "users_update_own_store_reviews" ON public.store_reviews;
CREATE POLICY "users_update_own_store_reviews" ON public.store_reviews FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "users_delete_own_store_reviews" ON public.store_reviews;
CREATE POLICY "users_delete_own_store_reviews" ON public.store_reviews FOR DELETE TO authenticated USING (auth.uid() = reviewer_id);

-- ============================================================
-- 16. STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('hamper-images', 'hamper-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('store-assets', 'store-assets', true) ON CONFLICT DO NOTHING;

-- Storage policies for product-images
DROP POLICY IF EXISTS "public_read_product_images" ON storage.objects;
CREATE POLICY "public_read_product_images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "auth_upload_product_images" ON storage.objects;
CREATE POLICY "auth_upload_product_images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "auth_update_product_images" ON storage.objects;
CREATE POLICY "auth_update_product_images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "auth_delete_product_images" ON storage.objects;
CREATE POLICY "auth_delete_product_images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');

-- Storage policies for hamper-images
DROP POLICY IF EXISTS "public_read_hamper_images" ON storage.objects;
CREATE POLICY "public_read_hamper_images" ON storage.objects FOR SELECT USING (bucket_id = 'hamper-images');

DROP POLICY IF EXISTS "auth_upload_hamper_images" ON storage.objects;
CREATE POLICY "auth_upload_hamper_images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'hamper-images');

-- Storage policies for store-assets
DROP POLICY IF EXISTS "public_read_store_assets" ON storage.objects;
CREATE POLICY "public_read_store_assets" ON storage.objects FOR SELECT USING (bucket_id = 'store-assets');

DROP POLICY IF EXISTS "auth_upload_store_assets" ON storage.objects;
CREATE POLICY "auth_upload_store_assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'store-assets');

-- ============================================================
-- DONE ✅
-- ============================================================
