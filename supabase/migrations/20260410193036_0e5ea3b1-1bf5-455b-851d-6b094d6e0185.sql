-- Extend shop_orders with POP fields (no new tables)
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS pop_url text;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS pop_uploaded_at timestamptz;

-- Indexes for order queries
CREATE INDEX IF NOT EXISTS idx_shop_orders_user_status ON public.shop_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON public.shop_orders(status);