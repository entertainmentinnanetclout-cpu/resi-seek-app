-- =====================================================
-- ORDER TRACKING + PROFILE PICTURES SQL
-- Safe to re-run multiple times (fully idempotent)
-- Run in external Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1) PROFILE PICTURES STORAGE BUCKET
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: anyone can view profile pictures (public bucket)
DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;
CREATE POLICY "Anyone can view profile pictures" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'profile-pictures');

-- Storage RLS: authenticated users can upload their own profile picture
DROP POLICY IF EXISTS "Users can upload own profile picture" ON storage.objects;
CREATE POLICY "Users can upload own profile picture" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage RLS: users can update their own profile picture
DROP POLICY IF EXISTS "Users can update own profile picture" ON storage.objects;
CREATE POLICY "Users can update own profile picture" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage RLS: users can delete their own profile picture
DROP POLICY IF EXISTS "Users can delete own profile picture" ON storage.objects;
CREATE POLICY "Users can delete own profile picture" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- 2) SHOP ORDERS — ADD TRACKING COLUMNS
-- =====================================================
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS estimated_delivery date;

-- =====================================================
-- 3) ORDER STATUS HISTORY TABLE (ensure exists)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  status text NOT NULL,
  note text,
  updated_by uuid,
  created_at timestamptz DEFAULT now()
);

-- FK to shop_orders
DO $$ BEGIN
  ALTER TABLE public.order_status_history
    ADD CONSTRAINT fk_order_status_history_order
    FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_all_order_history" ON public.order_status_history;
CREATE POLICY "admins_manage_all_order_history" ON public.order_status_history
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "system_insert_order_history" ON public.order_status_history;
CREATE POLICY "system_insert_order_history" ON public.order_status_history
FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "users_view_own_order_history" ON public.order_status_history;
CREATE POLICY "users_view_own_order_history" ON public.order_status_history
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shop_orders
    WHERE shop_orders.id = order_status_history.order_id
      AND shop_orders.user_id = auth.uid()
  )
);

-- =====================================================
-- 4) INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_user_id ON public.shop_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON public.shop_orders(status);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_order_id ON public.shop_order_items(order_id);

-- =====================================================
-- 5) REFRESH POSTGREST CACHE
-- =====================================================
NOTIFY pgrst, 'reload schema';
