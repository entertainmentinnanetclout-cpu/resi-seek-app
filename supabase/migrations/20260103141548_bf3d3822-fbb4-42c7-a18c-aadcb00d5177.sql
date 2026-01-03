-- Fix has_role function to bypass RLS (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Add virtual tour columns to residences
ALTER TABLE public.residences 
ADD COLUMN IF NOT EXISTS virtual_tour_url text;

ALTER TABLE public.residences 
ADD COLUMN IF NOT EXISTS virtual_tour_provider text;