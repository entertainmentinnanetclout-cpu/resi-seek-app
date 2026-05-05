
ALTER TABLE public.shop_order_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.shop_order_items ALTER COLUMN store_id DROP NOT NULL;
ALTER TABLE public.shop_order_items ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'product';
ALTER TABLE public.shop_order_items ADD COLUMN IF NOT EXISTS hamper_id uuid;
ALTER TABLE public.shop_order_items ADD COLUMN IF NOT EXISTS hamper_item_id uuid;
ALTER TABLE public.shop_order_items ADD COLUMN IF NOT EXISTS title_snapshot text;
ALTER TABLE public.shop_order_items ADD COLUMN IF NOT EXISTS image_snapshot text;
