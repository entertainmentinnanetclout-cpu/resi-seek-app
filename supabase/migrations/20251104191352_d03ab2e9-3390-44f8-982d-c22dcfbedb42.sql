-- Fix security issues

-- 1. Fix profiles RLS policy - remove overly permissive listing owner policy
DROP POLICY IF EXISTS "Users can view listing owner profiles" ON profiles;

-- 2. Create a more restrictive policy for marketplace context only
CREATE POLICY "Users can view basic seller info for verified listings"
ON profiles FOR SELECT
USING (
  id IN (
    SELECT user_id 
    FROM marketplace_listings 
    WHERE verified = true AND status = 'active'
  )
);

-- 3. Add a featured field to residences for top priorities
ALTER TABLE residences ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;
ALTER TABLE residences ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- 4. Add filtering columns for better search
ALTER TABLE residences ADD COLUMN IF NOT EXISTS distance_from_campus numeric;
ALTER TABLE residences ADD COLUMN IF NOT EXISTS room_type text;

-- 5. Add storage policy for marketplace with file type validation
DROP POLICY IF EXISTS "Restrict marketplace uploads to images" ON storage.objects;
CREATE POLICY "Restrict marketplace uploads to images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'marketplace' AND
  (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'gif', 'webp'))
);