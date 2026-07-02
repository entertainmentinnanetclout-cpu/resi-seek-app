-- =====================================================================
-- RESIDENCE PORTAL MASTER GOD MODE SQL — External Supabase
-- Rerunnable. Safe to execute multiple times.
-- Goal: kill the "{}" error on Create Residence Portal by moving both
-- writes into ONE atomic Postgres RPC that returns readable errors.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PHASE 1 · Enum + user_roles safety
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'residence_portal'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'residence_portal';
  END IF;
END$$;

-- Legacy single-column unique breaks multi-role users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_user_id_key'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_user_id_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_user_id_role_key'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END$$;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- ---------------------------------------------------------------------
-- PHASE 2 · residence_portal_accounts hardening
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.residence_portal_accounts (
  residence_id uuid PRIMARY KEY,
  user_id      uuid,
  email        text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.residence_portal_accounts
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Drop duplicate/ambiguous FK on residence_id (keeps any *_rpa_* named one)
DO $$
DECLARE _n int;
BEGIN
  SELECT COUNT(*) INTO _n FROM pg_constraint
   WHERE conrelid = 'public.residence_portal_accounts'::regclass
     AND contype = 'f'
     AND 'residence_id' = ANY(
       SELECT attname FROM pg_attribute
       WHERE attrelid = conrelid AND attnum = ANY(conkey)
     );
  IF _n > 1 THEN
    IF EXISTS (SELECT 1 FROM pg_constraint
               WHERE conname='residence_portal_accounts_residence_id_fkey'
                 AND conrelid='public.residence_portal_accounts'::regclass) THEN
      ALTER TABLE public.residence_portal_accounts
        DROP CONSTRAINT residence_portal_accounts_residence_id_fkey;
    END IF;
  END IF;

  -- Ensure at least one FK exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='public.residence_portal_accounts'::regclass AND contype='f'
  ) THEN
    ALTER TABLE public.residence_portal_accounts
      ADD CONSTRAINT rpa_residence_fk
      FOREIGN KEY (residence_id) REFERENCES public.residences(id) ON DELETE CASCADE;
  END IF;
END$$;

-- One portal per auth user
CREATE UNIQUE INDEX IF NOT EXISTS rpa_user_id_unique
  ON public.residence_portal_accounts(user_id) WHERE user_id IS NOT NULL;

-- Case-insensitive unique email
CREATE UNIQUE INDEX IF NOT EXISTS rpa_email_lower_unique
  ON public.residence_portal_accounts(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.residence_portal_accounts TO authenticated;
GRANT ALL ON public.residence_portal_accounts TO service_role;

ALTER TABLE public.residence_portal_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rpa_admin_all ON public.residence_portal_accounts;
CREATE POLICY rpa_admin_all ON public.residence_portal_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS rpa_owner_read ON public.residence_portal_accounts;
CREATE POLICY rpa_owner_read ON public.residence_portal_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_rpa_updated_at ON public.residence_portal_accounts;
CREATE TRIGGER trg_rpa_updated_at BEFORE UPDATE ON public.residence_portal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- PHASE 3 · Atomic creator RPC (the fix for `{}`)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_residence_portal(
  _residence_id uuid,
  _user_id      uuid,
  _email        text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_role(_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  IF _residence_id IS NULL OR _user_id IS NULL OR _email IS NULL OR _email = '' THEN
    RAISE EXCEPTION 'residence_id, user_id and email are required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.residences WHERE id = _residence_id) THEN
    RAISE EXCEPTION 'Residence % not found', _residence_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.residence_portal_accounts WHERE residence_id = _residence_id) THEN
    RAISE EXCEPTION 'This residence already has a portal account';
  END IF;

  IF EXISTS (SELECT 1 FROM public.residence_portal_accounts WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'This user is already linked to another portal';
  END IF;

  IF EXISTS (SELECT 1 FROM public.residence_portal_accounts WHERE lower(email) = lower(_email)) THEN
    RAISE EXCEPTION 'Portal email % is already in use', _email;
  END IF;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (_user_id, 'residence_portal'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.residence_portal_accounts(residence_id, user_id, email, is_active)
  VALUES (_residence_id, _user_id, _email, true);

  RETURN jsonb_build_object(
    'success', true,
    'residence_id', _residence_id,
    'user_id', _user_id,
    'email', _email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_residence_portal(uuid,uuid,text) TO authenticated, service_role;

-- Deactivate helper
CREATE OR REPLACE FUNCTION public.admin_set_residence_portal_active(
  _residence_id uuid,
  _active boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.residence_portal_accounts
     SET is_active = _active, updated_at = now()
   WHERE residence_id = _residence_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portal for residence % not found', _residence_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'residence_id', _residence_id, 'is_active', _active);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_residence_portal_active(uuid,boolean) TO authenticated, service_role;

-- Delete helper (also removes residence_portal role from that auth user)
CREATE OR REPLACE FUNCTION public.admin_delete_residence_portal(_residence_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO _uid FROM public.residence_portal_accounts WHERE residence_id = _residence_id;
  DELETE FROM public.residence_portal_accounts WHERE residence_id = _residence_id;

  IF _uid IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = _uid AND role = 'residence_portal'::app_role;
  END IF;

  RETURN jsonb_build_object('success', true, 'residence_id', _residence_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_residence_portal(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- PHASE 4 · Verification
-- ---------------------------------------------------------------------
SELECT 'enum_has_residence_portal' AS check, EXISTS (
  SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
  WHERE t.typname='app_role' AND e.enumlabel='residence_portal'
) AS ok;

SELECT 'user_roles_composite_unique' AS check, EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname='user_roles_user_id_role_key' AND conrelid='public.user_roles'::regclass
) AS ok;

SELECT 'user_roles_legacy_unique_gone' AS check, NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname='user_roles_user_id_key' AND conrelid='public.user_roles'::regclass
) AS ok;

SELECT 'rpa_single_residence_fk' AS check, COUNT(*) = 1 AS ok
FROM pg_constraint
WHERE conrelid='public.residence_portal_accounts'::regclass AND contype='f';

SELECT 'rpc_admin_create_residence_portal' AS check, EXISTS (
  SELECT 1 FROM pg_proc WHERE proname='admin_create_residence_portal'
) AS ok;

SELECT 'portal_accounts_count' AS metric, COUNT(*) AS value FROM public.residence_portal_accounts;
SELECT 'residence_portal_role_count' AS metric, COUNT(*) AS value
  FROM public.user_roles WHERE role='residence_portal'::app_role;