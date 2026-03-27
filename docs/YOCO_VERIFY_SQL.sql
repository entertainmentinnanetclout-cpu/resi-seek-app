-- ============================================================
-- YOCO VERIFY PAYMENT SQL — External Supabase (mefjzkhobkltlbmhusdh)
-- Idempotent: safe to run multiple times
-- ============================================================

-- 1. Add yoco_checkout_id to shop_orders for verification lookup
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS yoco_checkout_id text;

-- 2. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
