-- Add section_category column to residences for manual section override
ALTER TABLE public.residences 
  ADD COLUMN IF NOT EXISTS section_category TEXT DEFAULT NULL;

-- Add comment explaining usage
COMMENT ON COLUMN public.residences.section_category IS 'Manual override for Find My Res sections. If null, uses campus field for auto-grouping.';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';