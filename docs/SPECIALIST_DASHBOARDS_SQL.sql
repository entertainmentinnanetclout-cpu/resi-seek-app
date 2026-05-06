-- =====================================================================
-- ResKonnect — Specialist Dashboards Master SQL
-- Run on EXTERNAL Supabase (production source of truth).
-- Safe to re-run (idempotent).
-- =====================================================================

-- 1) Ensure app_role enum has the specialist roles
DO $$
BEGIN
  -- growth_lead → Media Dashboard (/media)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'growth_lead'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'growth_lead';
  END IF;

  -- commerce_lead → Commerce Dashboard (/commerce)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'commerce_lead'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'commerce_lead';
  END IF;
END $$;

-- 2) Helper: assign a specialist role to a user by email (idempotent)
CREATE OR REPLACE FUNCTION public.grant_specialist_role(_email text, _role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  IF _role NOT IN ('growth_lead', 'commerce_lead') THEN
    RAISE EXCEPTION 'Only growth_lead or commerce_lead allowed via this helper';
  END IF;

  SELECT id INTO _uid FROM auth.users WHERE email = _email LIMIT 1;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No user with email %', _email;
  END IF;

  -- Remove conflicting student role so the staff routing kicks in
  DELETE FROM public.user_roles
  WHERE user_id = _uid AND role::text = 'student';

  INSERT INTO public.user_roles(user_id, role)
  VALUES (_uid, _role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- 3) Helper: revoke a specialist role
CREATE OR REPLACE FUNCTION public.revoke_specialist_role(_email text, _role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = _email LIMIT 1;
  IF _uid IS NULL THEN RETURN; END IF;
  DELETE FROM public.user_roles
  WHERE user_id = _uid AND role::text = _role;
END;
$$;

-- =====================================================================
-- USAGE — uncomment & edit emails to assign:
-- =====================================================================
-- SELECT public.grant_specialist_role('media-exec@reskonnect.com',    'growth_lead');
-- SELECT public.grant_specialist_role('commerce-exec@reskonnect.com', 'commerce_lead');
--
-- To revoke:
-- SELECT public.revoke_specialist_role('media-exec@reskonnect.com', 'growth_lead');
-- =====================================================================
