-- ResKonnect residence team access (maximum three distinct login emails).
-- Preserve all existing residence/user assignments, application records and Auth identities.
BEGIN;

ALTER TABLE public.residence_portal_accounts
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS portal_role text DEFAULT 'owner';

UPDATE public.residence_portal_accounts SET id=gen_random_uuid() WHERE id IS NULL;
UPDATE public.residence_portal_accounts SET portal_role='owner' WHERE portal_role IS NULL;
ALTER TABLE public.residence_portal_accounts
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN portal_role SET NOT NULL,
  ALTER COLUMN portal_role SET DEFAULT 'manager';
ALTER TABLE public.residence_portal_accounts
  DROP CONSTRAINT IF EXISTS residence_portal_accounts_pkey;
ALTER TABLE public.residence_portal_accounts
  ADD CONSTRAINT residence_portal_accounts_pkey PRIMARY KEY (id),
  ADD CONSTRAINT residence_portal_accounts_portal_role_check
    CHECK (portal_role IN ('owner','manager','admin'));

CREATE INDEX IF NOT EXISTS residence_portal_team_residence_idx
  ON public.residence_portal_accounts(residence_id,is_active);
CREATE UNIQUE INDEX IF NOT EXISTS residence_portal_one_owner_idx
  ON public.residence_portal_accounts(residence_id) WHERE portal_role='owner';

-- A row lock on the parent residence serializes concurrent inserts and transfers
-- from different client sessions so they cannot both pass a naive count query.
CREATE OR REPLACE FUNCTION public.enforce_residence_portal_team_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE member_count integer;
BEGIN
  IF TG_OP='INSERT' OR NEW.residence_id IS DISTINCT FROM OLD.residence_id THEN
    PERFORM 1 FROM public.residences WHERE id=NEW.residence_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Residence not found' USING ERRCODE='23503';
    END IF;
    SELECT count(*) INTO member_count FROM public.residence_portal_accounts
      WHERE residence_id=NEW.residence_id;
    IF member_count>=3 THEN
      RAISE EXCEPTION 'A residence may have a maximum of three portal login emails'
        USING ERRCODE='23514';
    END IF;
  END IF;
  NEW.email=lower(btrim(NEW.email));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_residence_portal_team_limit() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS residence_portal_team_limit ON public.residence_portal_accounts;
CREATE TRIGGER residence_portal_team_limit
  BEFORE INSERT OR UPDATE OF residence_id,email
  ON public.residence_portal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_residence_portal_team_limit();

ALTER TABLE public.reskonnect_portal_account_audit
  DROP CONSTRAINT IF EXISTS reskonnect_portal_account_audit_action_check;
ALTER TABLE public.reskonnect_portal_account_audit
  ADD CONSTRAINT reskonnect_portal_account_audit_action_check
    CHECK (action IN ('created','updated','role_changed','deactivated','reactivated','removed'));

-- Disable the legacy residence-scoped deletion, which would now wipe up to 3 users.
-- All revocations must target an individual portal account ID.
CREATE OR REPLACE FUNCTION public.admin_delete_residence_portal(_residence_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  RAISE EXCEPTION 'This operation has been replaced by per-account revocation'
    USING ERRCODE='0A000';
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_residence_portal(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_residence_portal_account(_account_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE member record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE='42501';
  END IF;
  DELETE FROM public.residence_portal_accounts
    WHERE id=_account_id
    RETURNING id,residence_id,user_id,email INTO member;
  IF NOT FOUND THEN RAISE EXCEPTION 'Portal account not found' USING ERRCODE='P0002'; END IF;
  IF member.user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.residence_portal_accounts WHERE user_id=member.user_id
  ) THEN
    DELETE FROM public.user_roles WHERE user_id=member.user_id AND role='residence_portal'::public.app_role;
  END IF;
  INSERT INTO public.reskonnect_portal_account_audit
    (admin_user_id,portal_user_id,action,original_residence_id,new_residence_id,email_changed)
    VALUES(auth.uid(),member.user_id,'removed',member.residence_id,NULL,false);
  RETURN jsonb_build_object('success',true,'account_id',member.id,
    'auth_identity_preserved',true,'residence_id',member.residence_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_residence_portal_account(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_residence_portal_account(uuid) TO authenticated,service_role;

-- For legacy/pre-provisioned rows only: claim by a verified matching Auth email,
-- without allowing the caller to alter role, residence, status or email fields.
DROP POLICY IF EXISTS rpa_self_claim_by_email ON public.residence_portal_accounts;
CREATE OR REPLACE FUNCTION public.claim_residence_portal_account()
RETURNS TABLE(residence_id uuid,user_id uuid,email text,is_active boolean,portal_role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE member record; identity_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required' USING ERRCODE='42501'; END IF;
  SELECT lower(u.email) INTO identity_email FROM auth.users u
    WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL;
  IF identity_email IS NULL THEN RAISE EXCEPTION 'Verified email required' USING ERRCODE='42501'; END IF;
  SELECT a.id,a.residence_id,a.user_id,a.email,a.is_active,a.portal_role INTO member
    FROM public.residence_portal_accounts a
    WHERE a.user_id IS NULL AND lower(a.email)=identity_email
    FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.residence_portal_accounts a SET user_id=auth.uid()
    WHERE a.id=member.id AND a.user_id IS NULL;
  INSERT INTO public.user_roles(user_id,role)
    VALUES(auth.uid(),'residence_portal'::public.app_role)
    ON CONFLICT(user_id,role) DO NOTHING;
  RETURN QUERY SELECT a.residence_id,a.user_id,a.email,a.is_active,a.portal_role
    FROM public.residence_portal_accounts a WHERE a.id=member.id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_residence_portal_account() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_residence_portal_account() TO authenticated;

-- Backwards compatibility for the original create RPC used by older clients.
-- The currently deployed AdminOS endpoint performs the full role-aware write.
CREATE OR REPLACE FUNCTION public.admin_create_residence_portal(
 _residence_id uuid,_user_id uuid,_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE next_role text; n integer; assignment_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Admin role required' USING ERRCODE='42501';
 END IF;
 IF _residence_id IS NULL OR _user_id IS NULL OR nullif(trim(_email),'') IS NULL THEN
  RAISE EXCEPTION 'Missing portal account details' USING ERRCODE='22023';
 END IF;
 PERFORM 1 FROM public.residences WHERE id=_residence_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Residence not found' USING ERRCODE='P0002'; END IF;
 SELECT count(*) INTO n FROM public.residence_portal_accounts WHERE residence_id=_residence_id;
 IF n>=3 THEN RAISE EXCEPTION 'Maximum of 3 portal accounts per residence' USING ERRCODE='23514'; END IF;
 IF EXISTS (SELECT 1 FROM public.residence_portal_accounts WHERE user_id=_user_id OR lower(email)=lower(trim(_email))) THEN
  RAISE EXCEPTION 'Portal login already assigned' USING ERRCODE='23505';
 END IF;
 next_role:=CASE WHEN n=0 THEN 'owner' ELSE 'manager' END;
 INSERT INTO public.user_roles(user_id,role) VALUES(_user_id,'residence_portal'::public.app_role)
  ON CONFLICT(user_id,role) DO NOTHING;
 INSERT INTO public.residence_portal_accounts(residence_id,user_id,email,is_active,portal_role)
  VALUES(_residence_id,_user_id,lower(trim(_email)),true,next_role) RETURNING id INTO assignment_id;
 INSERT INTO public.reskonnect_portal_account_audit
  (admin_user_id,portal_user_id,action,original_residence_id,new_residence_id,email_changed)
  VALUES(auth.uid(),_user_id,'created',NULL,_residence_id,false);
 RETURN jsonb_build_object('success',true,'account_id',assignment_id,'portal_role',next_role);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_residence_portal(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_create_residence_portal(uuid,uuid,text) TO authenticated,service_role;

COMMIT;
