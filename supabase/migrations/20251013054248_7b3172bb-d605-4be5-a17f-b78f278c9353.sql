-- Add verified field to marketplace_listings
ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

-- Add institution field to profiles (using campus as institution)
-- Campus already exists, so we'll use that

-- Update marketplace_listings to restrict categories
-- Add check constraint for allowed categories
ALTER TABLE public.marketplace_listings 
DROP CONSTRAINT IF EXISTS marketplace_listings_category_check;

ALTER TABLE public.marketplace_listings
ADD CONSTRAINT marketplace_listings_category_check 
CHECK (category IN ('Electronics', 'Books', 'Study Materials'));

-- Add check constraint for max 3 images
ALTER TABLE public.marketplace_listings
ADD CONSTRAINT marketplace_listings_images_length_check
CHECK (array_length(images, 1) IS NULL OR array_length(images, 1) <= 3);

-- Update RLS policy to only show verified listings to non-owners
DROP POLICY IF EXISTS "Everyone can view active listings" ON public.marketplace_listings;

CREATE POLICY "Everyone can view verified active listings"
ON public.marketplace_listings
FOR SELECT
USING (
  (status = 'active' AND verified = true) 
  OR (auth.uid() = user_id)
);

-- Allow users to view their own profiles for verification
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Allow users to view profiles of listing owners (for marketplace)
CREATE POLICY "Users can view listing owner profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.marketplace_listings
    WHERE marketplace_listings.user_id = profiles.id
    AND marketplace_listings.verified = true
  )
);

-- Enable realtime for marketplace listings
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_listings;