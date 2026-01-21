
-- Fix function search_path for generate_ref_code
CREATE OR REPLACE FUNCTION generate_ref_code(app_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT UPPER(SUBSTRING(REPLACE(app_id::text, '-', '') FROM 1 FOR 8))
$$;
