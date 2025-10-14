-- Fix function search_path for update_updated_at_column
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;