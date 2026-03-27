-- ============================================================
-- YOCO PAYMENT GATEWAY SQL — External Supabase (mefjzkhobkltlbmhusdh)
-- Idempotent: safe to run multiple times
-- ============================================================

-- 1. Add payment routing columns to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'standard';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS checkout_url text;

-- 2. Add tracking columns to shop_orders (if not already added)
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS estimated_delivery date;

-- 3. Webhook events audit table
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

-- 4. Index for webhook processing
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events (processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON public.webhook_events (provider);

-- 5. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
