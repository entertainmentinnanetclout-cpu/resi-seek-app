-- =====================================================
-- COMPREHENSIVE MARKETPLACE & FEATURES SQL
-- =====================================================

-- 1. STORE REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.store_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, reviewer_id)
);

ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view store reviews" ON public.store_reviews;
CREATE POLICY "Anyone can view store reviews" ON public.store_reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create reviews" ON public.store_reviews;
CREATE POLICY "Authenticated users can create reviews" ON public.store_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.store_reviews;
CREATE POLICY "Users can update their own reviews" ON public.store_reviews
  FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.store_reviews;
CREATE POLICY "Users can delete their own reviews" ON public.store_reviews
  FOR DELETE TO authenticated USING (auth.uid() = reviewer_id);

-- 2. MARKETPLACE ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id),
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  quantity INTEGER DEFAULT 1,
  total_price DECIMAL(10,2) NOT NULL,
  buyer_notes TEXT,
  delivery_address TEXT,
  buyer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers can view their orders" ON public.marketplace_orders;
CREATE POLICY "Buyers can view their orders" ON public.marketplace_orders
  FOR SELECT TO authenticated USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Sellers can view their orders" ON public.marketplace_orders;
CREATE POLICY "Sellers can view their orders" ON public.marketplace_orders
  FOR SELECT TO authenticated USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Buyers can create orders" ON public.marketplace_orders;
CREATE POLICY "Buyers can create orders" ON public.marketplace_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Sellers can update order status" ON public.marketplace_orders;
CREATE POLICY "Sellers can update order status" ON public.marketplace_orders
  FOR UPDATE TO authenticated USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Admins can view all orders" ON public.marketplace_orders;
CREATE POLICY "Admins can view all orders" ON public.marketplace_orders
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update all orders" ON public.marketplace_orders;
CREATE POLICY "Admins can update all orders" ON public.marketplace_orders
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. ADMIN POLICIES FOR MARKETPLACE LISTINGS
DROP POLICY IF EXISTS "Admins can view all marketplace listings" ON public.marketplace_listings;
CREATE POLICY "Admins can view all marketplace listings" ON public.marketplace_listings
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update all marketplace listings" ON public.marketplace_listings;
CREATE POLICY "Admins can update all marketplace listings" ON public.marketplace_listings
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete marketplace listings" ON public.marketplace_listings;
CREATE POLICY "Admins can delete marketplace listings" ON public.marketplace_listings
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. ADMIN POLICIES FOR STORES
DROP POLICY IF EXISTS "Admins can view all stores" ON public.stores;
CREATE POLICY "Admins can view all stores" ON public.stores
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update all stores" ON public.stores;
CREATE POLICY "Admins can update all stores" ON public.stores
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete stores" ON public.stores;
CREATE POLICY "Admins can delete stores" ON public.stores
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. ADD VERIFIED COLUMN TO STORES IF NOT EXISTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stores' AND column_name = 'verified'
  ) THEN
    ALTER TABLE public.stores ADD COLUMN verified BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 6. ADD SLUG TO BURSARIES FOR BRANDED URLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bursaries' AND column_name = 'slug'
  ) THEN
    ALTER TABLE public.bursaries ADD COLUMN slug TEXT UNIQUE;
  END IF;
END $$;

-- 7. ENABLE REALTIME FOR NEW TABLES
ALTER TABLE public.store_reviews REPLICA IDENTITY FULL;
ALTER TABLE public.marketplace_orders REPLICA IDENTITY FULL;

-- 8. STORAGE POLICIES FOR PROFILE PICTURES (ensure they exist)
DO $$
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Users can upload their own profile picture'
  ) THEN
    CREATE POLICY "Users can upload their own profile picture" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'profile-pictures' 
        AND (auth.uid()::text = (storage.foldername(name))[1])
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Users can update their own profile picture'
  ) THEN
    CREATE POLICY "Users can update their own profile picture" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'profile-pictures' 
        AND (auth.uid()::text = (storage.foldername(name))[1])
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Anyone can view profile pictures'
  ) THEN
    CREATE POLICY "Anyone can view profile pictures" ON storage.objects
      FOR SELECT USING (bucket_id = 'profile-pictures');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Users can delete their own profile picture'
  ) THEN
    CREATE POLICY "Users can delete their own profile picture" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'profile-pictures' 
        AND (auth.uid()::text = (storage.foldername(name))[1])
      );
  END IF;
END $$;