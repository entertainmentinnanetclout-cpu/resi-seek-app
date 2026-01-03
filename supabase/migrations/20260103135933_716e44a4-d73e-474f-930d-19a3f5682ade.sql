-- Add is_trusted column to residences table for admin control
ALTER TABLE residences ADD COLUMN IF NOT EXISTS is_trusted boolean DEFAULT false;