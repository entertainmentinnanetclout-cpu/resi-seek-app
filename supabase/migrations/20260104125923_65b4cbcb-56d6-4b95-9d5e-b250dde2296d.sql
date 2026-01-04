-- Add images array column to residences for multiple photos (slideshow support)
ALTER TABLE public.residences ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';