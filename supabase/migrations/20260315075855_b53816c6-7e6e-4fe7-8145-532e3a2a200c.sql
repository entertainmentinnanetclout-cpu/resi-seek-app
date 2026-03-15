
-- ============================================
-- MARKETPLACE COMMERCE SYSTEM - SAFE MIGRATION
-- ============================================

-- 1. Product Categories
CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  parent_id uuid REFERENCES public.product_categories(id),
  image_url text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. Products (replaces marketplace_listings for store inventory)
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES public.product_categories(id),
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  compare_at_price numeric,
  brand text,
  images text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  stock_quantity integer DEFAULT 0,
  sku text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Product Variants
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  variant_name text NOT NULL,
  price numeric NOT NULL,
  sku text,
  stock_quantity integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4. Cart
CREATE TABLE IF NOT EXISTS public.cart (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. Cart Items
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid REFERENCES public.cart(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  variant_id uuid REFERENCES public.product_variants(id),
  quantity integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- 6. Shop Orders
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  payment_method text DEFAULT 'cod',
  payment_status text DEFAULT 'pending',
  total_amount numeric NOT NULL,
  delivery_address text,
  delivery_phone text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. Shop Order Items
CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.shop_orders(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) NOT NULL,
  variant_id uuid REFERENCES public.product_variants(id),
  store_id uuid REFERENCES public.stores(id) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 8. Order Status History
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.shop_orders(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL,
  updated_by uuid,
  note text,
  created_at timestamptz DEFAULT now()
);

-- 9. Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.shop_orders(id) ON DELETE CASCADE NOT NULL,
  payment_method text NOT NULL,
  payment_gateway text,
  payment_status text DEFAULT 'pending',
  transaction_reference text,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 10. Hampers (bundle products)
CREATE TABLE IF NOT EXISTS public.hampers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image_url text,
  category text DEFAULT 'general',
  stock_quantity integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 11. Hamper Bundle Items
CREATE TABLE IF NOT EXISTS public.hamper_bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hamper_id uuid REFERENCES public.hampers(id) ON DELETE CASCADE NOT NULL,
  item_name text NOT NULL,
  quantity integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- 12. Hamper Orders
CREATE TABLE IF NOT EXISTS public.hamper_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_number text NOT NULL UNIQUE,
  status text DEFAULT 'pending',
  payment_method text DEFAULT 'cod',
  payment_status text DEFAULT 'pending',
  total_amount numeric NOT NULL,
  delivery_address text,
  delivery_phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 13. Hamper Order Items
CREATE TABLE IF NOT EXISTS public.hamper_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.hamper_orders(id) ON DELETE CASCADE NOT NULL,
  hamper_id uuid REFERENCES public.hampers(id) NOT NULL,
  quantity integer DEFAULT 1,
  price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products(is_featured);
CREATE INDEX IF NOT EXISTS idx_cart_user_id ON public.cart(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_user_id ON public.shop_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON public.shop_orders(status);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_order_id ON public.shop_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_store_id ON public.shop_order_items(store_id);
CREATE INDEX IF NOT EXISTS idx_hampers_is_active ON public.hampers(is_active);
CREATE INDEX IF NOT EXISTS idx_hamper_orders_user_id ON public.hamper_orders(user_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hampers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hamper_bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hamper_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hamper_order_items ENABLE ROW LEVEL SECURITY;

-- Categories: public read, admin write
CREATE POLICY "anyone_view_categories" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "admins_manage_categories" ON public.product_categories FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Products: public read active, store owners manage own, admin all
CREATE POLICY "anyone_view_active_products" ON public.products FOR SELECT USING (is_active = true);
CREATE POLICY "store_owners_manage_products" ON public.products FOR ALL
  USING (EXISTS (SELECT 1 FROM public.stores WHERE id = products.store_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores WHERE id = products.store_id AND user_id = auth.uid()));
CREATE POLICY "admins_manage_all_products" ON public.products FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Product Variants
CREATE POLICY "anyone_view_variants" ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "store_owners_manage_variants" ON public.product_variants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON p.store_id = s.id WHERE p.id = product_variants.product_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON p.store_id = s.id WHERE p.id = product_variants.product_id AND s.user_id = auth.uid()));
CREATE POLICY "admins_manage_all_variants" ON public.product_variants FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Cart
CREATE POLICY "users_manage_own_cart" ON public.cart FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Cart Items
CREATE POLICY "users_manage_own_cart_items" ON public.cart_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.cart WHERE id = cart_items.cart_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cart WHERE id = cart_items.cart_id AND user_id = auth.uid()));

-- Shop Orders
CREATE POLICY "users_manage_own_shop_orders" ON public.shop_orders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins_manage_all_shop_orders" ON public.shop_orders FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Shop Order Items
CREATE POLICY "users_view_own_shop_order_items" ON public.shop_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shop_orders WHERE id = shop_order_items.order_id AND user_id = auth.uid()));
CREATE POLICY "sellers_view_their_order_items" ON public.shop_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.stores WHERE id = shop_order_items.store_id AND user_id = auth.uid()));
CREATE POLICY "system_insert_shop_order_items" ON public.shop_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "admins_manage_all_shop_order_items" ON public.shop_order_items FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Order Status History
CREATE POLICY "users_view_own_order_history" ON public.order_status_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shop_orders WHERE id = order_status_history.order_id AND user_id = auth.uid()));
CREATE POLICY "system_insert_order_history" ON public.order_status_history FOR INSERT WITH CHECK (true);
CREATE POLICY "admins_manage_all_order_history" ON public.order_status_history FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Payments
CREATE POLICY "users_view_own_payments" ON public.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shop_orders WHERE id = payments.order_id AND user_id = auth.uid()));
CREATE POLICY "system_insert_payments" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "admins_manage_all_payments" ON public.payments FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Hampers: public read active, admin manage
CREATE POLICY "anyone_view_active_hampers" ON public.hampers FOR SELECT USING (is_active = true);
CREATE POLICY "admins_manage_all_hampers" ON public.hampers FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Hamper Bundle Items
CREATE POLICY "anyone_view_hamper_bundle_items" ON public.hamper_bundle_items FOR SELECT USING (true);
CREATE POLICY "admins_manage_hamper_bundle_items" ON public.hamper_bundle_items FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Hamper Orders
CREATE POLICY "users_manage_own_hamper_orders" ON public.hamper_orders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins_manage_all_hamper_orders" ON public.hamper_orders FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Hamper Order Items
CREATE POLICY "users_view_own_hamper_order_items" ON public.hamper_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.hamper_orders WHERE id = hamper_order_items.order_id AND user_id = auth.uid()));
CREATE POLICY "system_insert_hamper_order_items" ON public.hamper_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "admins_manage_all_hamper_order_items" ON public.hamper_order_items FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ============================================
-- TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS products_updated ON public.products;
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS shop_orders_updated ON public.shop_orders;
CREATE TRIGGER shop_orders_updated BEFORE UPDATE ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS hampers_updated ON public.hampers;
CREATE TRIGGER hampers_updated BEFORE UPDATE ON public.hampers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS hamper_orders_updated ON public.hamper_orders;
CREATE TRIGGER hamper_orders_updated BEFORE UPDATE ON public.hamper_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('hamper-images', 'hamper-images', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for product-images
CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Authenticated users upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users delete own product images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for hamper-images
CREATE POLICY "Anyone can view hamper images" ON storage.objects FOR SELECT USING (bucket_id = 'hamper-images');
CREATE POLICY "Admins upload hamper images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'hamper-images' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete hamper images" ON storage.objects FOR DELETE USING (bucket_id = 'hamper-images' AND has_role(auth.uid(), 'admin'));
