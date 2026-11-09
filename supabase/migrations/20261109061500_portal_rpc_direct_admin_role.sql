-- The shared has_role() helper depends on auth.role(), which is NULL
-- inside service-only RPC execution. Check verified AdminOS assignments
-- directly within these privileged, service_role-only functions.
BEGIN;

CREATE OR REPLACE FUNCTION public.portal_prepare_orphan_profile_email(p_email text,p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_email text:=lower(btrim(coalesce(p_email,'')));
 legacy record;
 fk record;
 affected boolean;
 placeholder text;
BEGIN
 -- EXECUTE is granted only to service_role; the PostgREST JWT GUC
 -- may be unset despite a valid service-role request.
 IF p_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles AS assigned
    WHERE assigned.user_id=p_admin_id AND assigned.role='admin'::public.app_role
 )
 THEN RAISE EXCEPTION 'Admin role required' USING ERRCODE='42501'; END IF;
 IF length(v_email)>254 OR position('@' in v_email)=0
 THEN RAISE EXCEPTION 'Invalid email address' USING ERRCODE='22023'; END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(v_email,20261109));
 SELECT p.id,p.role,p.student_number,p.identity_number,p.phone
 INTO legacy FROM public.profiles p
 LEFT JOIN auth.users u ON u.id=p.id
 WHERE lower(p.email)=v_email AND u.id IS NULL
 FOR UPDATE OF p;
 IF NOT FOUND THEN RETURN jsonb_build_object('archived',false); END IF;
 IF legacy.role::text<>'student' OR
   legacy.student_number IS NOT NULL OR legacy.identity_number IS NOT NULL OR
   legacy.phone IS NOT NULL OR
   EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id=legacy.id)
 THEN
   RAISE EXCEPTION 'This legacy profile has protected identity data. Contact an administrator for manual account reconciliation'
     USING ERRCODE='23514';
 END IF;

 -- Never move a profile attached to academic, commercial or personal records.
 -- Simple CRM contact/enquiry references remain anchored to the archived row.
 FOR fk IN
  SELECT c.conrelid::regclass AS tbl, a.attname AS col,
         cardinality(c.conkey) AS key_count
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
  WHERE c.contype='f' AND c.confrelid='public.profiles'::regclass
 LOOP
  IF fk.key_count<>1 THEN
   RAISE EXCEPTION 'Profile has complex references; manual reconciliation required' USING ERRCODE='23514';
  END IF;
  IF fk.tbl IN ('public.adminos_contacts'::regclass,'public.adminos_enquiry_threads'::regclass)
   THEN CONTINUE; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE %I=$1)',fk.tbl,fk.col)
    INTO affected USING legacy.id;
  IF affected THEN
   RAISE EXCEPTION 'Legacy profile has related records; manual reconciliation required'
     USING ERRCODE='23514';
  END IF;
 END LOOP;

 placeholder:='archived-'||replace(legacy.id::text,'-','')||'@reskonnect.invalid';
 INSERT INTO reskonnect_internal.portal_orphan_email_archive
  (legacy_profile_id,original_email,placeholder_email,archived_by)
 VALUES(legacy.id,v_email,placeholder,p_admin_id)
 ON CONFLICT(legacy_profile_id) DO UPDATE SET
  original_email=excluded.original_email,
  placeholder_email=excluded.placeholder_email,
  archived_by=excluded.archived_by,
  archived_at=now(),
  restored_at=NULL;
 UPDATE public.profiles SET email=placeholder,updated_at=now() WHERE id=legacy.id AND lower(email)=v_email;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile reconciliation was interrupted' USING ERRCODE='40001'; END IF;
 RETURN jsonb_build_object('archived',true,'legacy_profile_id',legacy.id);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_prepare_orphan_profile_email(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_prepare_orphan_profile_email(text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.portal_replace_residence_login(
 p_account_id uuid,p_new_user_id uuid,p_email text,p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE current_account record; new_identity record; v_email text:=lower(btrim(coalesce(p_email,'')));
BEGIN
 -- EXECUTE is granted only to service_role; the PostgREST JWT GUC
 -- may be unset despite a valid service-role request.
 IF p_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles AS assigned
    WHERE assigned.user_id=p_admin_id AND assigned.role='admin'::public.app_role
 )
 THEN RAISE EXCEPTION 'Admin role required' USING ERRCODE='42501'; END IF;
 SELECT * INTO current_account FROM public.residence_portal_accounts WHERE id=p_account_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Portal account not found' USING ERRCODE='P0002'; END IF;
 SELECT id,email,email_confirmed_at,invited_at INTO new_identity FROM auth.users
 WHERE id=p_new_user_id AND lower(email)=v_email;
 IF NOT FOUND OR (new_identity.email_confirmed_at IS NULL AND new_identity.invited_at IS NULL)
 THEN RAISE EXCEPTION 'New login must own a verified email or have an outstanding invitation'
   USING ERRCODE='42501'; END IF;
 IF current_account.user_id=p_new_user_id THEN
  RAISE EXCEPTION 'Use the role editor for this existing login' USING ERRCODE='22023';
 END IF;
 IF EXISTS (SELECT 1 FROM public.residence_portal_accounts
  WHERE id<>p_account_id AND (user_id=p_new_user_id OR lower(email)=v_email))
 THEN RAISE EXCEPTION 'This login is already assigned to a residence' USING ERRCODE='23505'; END IF;
 INSERT INTO public.user_roles(user_id,role)
 VALUES(p_new_user_id,'residence_portal'::public.app_role)
 ON CONFLICT(user_id,role) DO NOTHING;
 UPDATE public.residence_portal_accounts
 SET user_id=p_new_user_id,email=v_email,updated_at=now()
 WHERE id=p_account_id;
 IF current_account.user_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.residence_portal_accounts WHERE user_id=current_account.user_id
 ) THEN
  DELETE FROM public.user_roles WHERE user_id=current_account.user_id
   AND role='residence_portal'::public.app_role;
 END IF;
 INSERT INTO public.reskonnect_portal_account_audit
  (admin_user_id,portal_user_id,action,original_residence_id,new_residence_id,email_changed)
 VALUES(p_admin_id,p_new_user_id,'replaced',current_account.residence_id,current_account.residence_id,true);
 RETURN jsonb_build_object('ok',true,'previous_user_id',current_account.user_id,'new_user_id',p_new_user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_replace_residence_login(uuid,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_replace_residence_login(uuid,uuid,text,uuid) TO service_role;
COMMIT;
