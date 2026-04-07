-- ============================================================
-- SELLER COMMISSION & PAYMENT SYSTEM SQL
-- External Supabase (mefjzkhobkltlbmhusdh)
-- Idempotent: safe to run multiple times
-- ============================================================

-- 1. Fix products columns (PGRST204 fix)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'standard';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS checkout_url text;

-- 2. Fix shop_orders (Yoco tracking)
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS yoco_checkout_id text;

-- 3. Stores: add custom fee override
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS custom_fee_percentage numeric(5,2);

-- 4. Seller earnings (per-order breakdown)
CREATE TABLE IF NOT EXISTS public.seller_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  order_id uuid NOT NULL,
  gross_amount numeric(10,2) NOT NULL,
  platform_fee numeric(10,2) DEFAULT 0,
  fee_percentage numeric(5,2) DEFAULT 0,
  net_amount numeric(10,2) NOT NULL,
  status text DEFAULT 'available',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_order_earning UNIQUE (order_id)
);

ALTER TABLE public.seller_earnings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admins_manage_all_earnings" ON public.seller_earnings
    FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin'))
    WITH CHECK (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "sellers_view_own_earnings" ON public.seller_earnings
    FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = seller_earnings.store_id
        AND stores.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "system_insert_earnings" ON public.seller_earnings
    FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Platform revenue log
CREATE TABLE IF NOT EXISTS public.platform_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  store_id uuid NOT NULL,
  gross_amount numeric(10,2),
  platform_fee numeric(10,2),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admins_manage_platform_revenue" ON public.platform_revenue
    FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin'))
    WITH CHECK (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "system_insert_platform_revenue" ON public.platform_revenue
    FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Payment proofs table (fallback for failed Yoco verification)
CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  image_url text,
  reference_number text,
  status text DEFAULT 'pending',
  admin_note text,
  reviewed_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users_manage_own_proofs" ON public.payment_proofs
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "admins_manage_all_proofs" ON public.payment_proofs
    FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin'))
    WITH CHECK (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "system_insert_proofs" ON public.payment_proofs
    FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Webhook events audit table
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admins_manage_webhooks" ON public.webhook_events
    FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin'))
    WITH CHECK (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "system_insert_webhooks" ON public.webhook_events
    FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Insert default platform fee setting
INSERT INTO public.platform_settings (key, value, description)
VALUES ('default_fee_percentage', '10'::jsonb, 'Default platform commission percentage for all stores')
ON CONFLICT (key) DO NOTHING;

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_seller_earnings_store ON public.seller_earnings (store_id);
CREATE INDEX IF NOT EXISTS idx_seller_earnings_order ON public.seller_earnings (order_id);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_store ON public.platform_revenue (store_id);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_order ON public.platform_revenue (order_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_order ON public.payment_proofs (order_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON public.payment_proofs (status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events (processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_shop_orders_yoco ON public.shop_orders (yoco_checkout_id) WHERE yoco_checkout_id IS NOT NULL;

-- 10. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
