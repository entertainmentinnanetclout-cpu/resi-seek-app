-- ============================================================
-- PAYMENT SYSTEM SQL — External Supabase (mefjzkhobkltlbmhusdh)
-- Idempotent: safe to run multiple times
-- ============================================================

-- 1. Add payment routing columns to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'standard';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS checkout_url text;

-- 2. Add Yoco checkout tracking to shop_orders
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS yoco_checkout_id text;

-- 3. Payment proofs table (fallback for failed Yoco verification)
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

-- RLS: users manage own proofs
DO $$ BEGIN
  CREATE POLICY "users_manage_own_proofs" ON public.payment_proofs
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: admins manage all proofs
DO $$ BEGIN
  CREATE POLICY "admins_manage_all_proofs" ON public.payment_proofs
    FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin'))
    WITH CHECK (has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: system insert proofs (for edge functions)
DO $$ BEGIN
  CREATE POLICY "system_insert_proofs" ON public.payment_proofs
    FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Webhook events audit table
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

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_payment_proofs_order ON public.payment_proofs (order_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON public.payment_proofs (status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events (processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON public.webhook_events (provider);
CREATE INDEX IF NOT EXISTS idx_shop_orders_yoco ON public.shop_orders (yoco_checkout_id) WHERE yoco_checkout_id IS NOT NULL;

-- 6. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
