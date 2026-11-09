-- Keep failed invitations safely retryable without losing the archived contact audit.\nBEGIN;\nCREATE OR REPLACE FUNCTION public.portal_prepare_orphan_profile_email(p_email text,p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_email text:=lower(btrim(coalesce(p_email,'')));
 legacy record;
 fk record;
 affected boolean;
 placeholder text;
BEGIN
 IF coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
 THEN RAISE EXCEPTION 'Service access required' USING ERRCODE='42501'; END IF;
 IF p_admin_id IS NULL OR NOT public.has_role(p_admin_id,'admin'::public.app_role)
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
REVOKE ALL ON FUNCTION public.portal_prepare_orphan_profile_email(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_prepare_orphan_profile_email(text,uuid) TO service_role;

COMMIT;\n