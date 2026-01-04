-- =====================================================
-- STORES TABLE FOR MARKETPLACE PERSONAL STORES
-- =====================================================

-- Create stores table
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_name TEXT NOT NULL,
  store_description TEXT,
  store_logo_url TEXT,
  store_banner_url TEXT,
  contact_whatsapp TEXT,
  contact_email TEXT,
  campus TEXT,
  is_active BOOLEAN DEFAULT true,
  total_sales INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on stores
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Store policies
CREATE POLICY "Anyone can view active stores" ON public.stores
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view their own store" ON public.stores
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own store" ON public.stores
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own store" ON public.stores
  FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own store" ON public.stores
  FOR DELETE TO authenticated 
  USING (auth.uid() = user_id);

-- Add store_id to marketplace_listings if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'marketplace_listings' AND column_name = 'store_id'
  ) THEN
    ALTER TABLE public.marketplace_listings 
      ADD COLUMN store_id UUID REFERENCES public.stores(id);
  END IF;
END $$;

-- Enable realtime for stores
ALTER TABLE public.stores REPLICA IDENTITY FULL;

-- Create storage bucket for store assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for store assets
CREATE POLICY "Anyone can view store assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-assets');

CREATE POLICY "Authenticated users can upload store assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'store-assets');

CREATE POLICY "Users can update their store assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'store-assets');

CREATE POLICY "Users can delete their store assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'store-assets');