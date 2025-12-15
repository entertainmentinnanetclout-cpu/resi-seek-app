-- Add province column to residences table for filtering
ALTER TABLE public.residences 
ADD COLUMN IF NOT EXISTS province text DEFAULT 'Gauteng';