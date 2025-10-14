-- Fix security definer view by setting security_invoker
ALTER VIEW public.marketplace_seller_profiles
SET (security_invoker = true);

-- Fix function search_path for prevent_last_admin_deletion
ALTER FUNCTION prevent_last_admin_deletion() SET search_path = public, pg_temp;