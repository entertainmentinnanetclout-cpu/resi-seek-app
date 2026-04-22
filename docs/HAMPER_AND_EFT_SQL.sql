-- ============================================================
-- Hamper Unification + EFT POP Mirroring + Storage Policies
-- Run in external Supabase SQL Editor (mefjzkhobkltlbmhusdh)
-- Idempotent — safe to run multiple times
-- ============================================================

-- 1. Hampers: ensure all needed columns exist
ALTER TABLE public.hampers ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE public.hampers ADD COLUMN IF NOT EXISTS is_landing_featured boolean DEFAULT false;

-- 2. hamper_bundle_items: optional FK link to the catalog
ALTER TABLE public.hamper_bundle_items
  ADD COLUMN IF NOT EXISTS hamper_item_id uuid REFERENCES public.hamper_items(id) ON DELETE SET NULL;

-- 3. shop_orders: confirm POP columns exist (re-runnable)
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS pop_url text;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS pop_uploaded_at timestamptz;

-- 4. eft_payments: FK + indexes
DO $$ BEGIN
  ALTER TABLE public.eft_payments
    ADD CONSTRAINT eft_payments_order_fkey
    FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_eft_payments_status_created
  ON public.eft_payments(status, created_at DESC);

-- 5. Storage bucket policy: ensure hamper-images is fully readable + writable by admins
INSERT INTO storage.buckets (id, name, public)
VALUES ('hamper-images','hamper-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN
  CREATE POLICY "admin_upload_hamper_images" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'hamper-images' AND public.has_role(auth.uid(),'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_update_hamper_images" ON storage.objects FOR UPDATE
    USING (bucket_id = 'hamper-images' AND public.has_role(auth.uid(),'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_delete_hamper_images" ON storage.objects FOR DELETE
    USING (bucket_id = 'hamper-images' AND public.has_role(auth.uid(),'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anyone_view_hamper_images" ON storage.objects FOR SELECT
    USING (bucket_id = 'hamper-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Same for admin-images (used by bursaries, news, events, slides)
INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-images','admin-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN
  CREATE POLICY "admin_upload_admin_images" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'admin-images' AND public.has_role(auth.uid(),'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anyone_view_admin_images" ON storage.objects FOR SELECT
    USING (bucket_id = 'admin-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. hamper_orders: cart-style POP support
ALTER TABLE public.hamper_orders ADD COLUMN IF NOT EXISTS pop_url text;
ALTER TABLE public.hamper_orders ADD COLUMN IF NOT EXISTS pop_uploaded_at timestamptz;

NOTIFY pgrst, 'reload schema';
