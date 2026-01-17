-- Add quality grade to residences
ALTER TABLE residences ADD COLUMN IF NOT EXISTS quality_grade TEXT DEFAULT 'standard';

-- Add image_url to student_discounts
ALTER TABLE student_discounts ADD COLUMN IF NOT EXISTS image_url TEXT;