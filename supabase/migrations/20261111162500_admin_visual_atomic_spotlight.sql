-- Phase 0 reliability: Spotlight order is a single authorised transaction.
CREATE OR REPLACE FUNCTION public.rk_admin_reorder_spotlight(p_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); selected_count integer; current_count integer;
BEGIN
 IF actor IS NULL OR NOT public.has_role(actor,'admin'::public.app_role)
    OR coalesce(auth.jwt()->>'aal','')<>'aal2' THEN
  RAISE EXCEPTION 'God Mode MFA required' USING ERRCODE='42501';
 END IF;
 selected_count:=coalesce(array_length(p_ids,1),0);
 IF selected_count>60 OR selected_count<>(SELECT count(DISTINCT x) FROM unnest(p_ids) AS x) THEN
  RAISE EXCEPTION 'Use unique Spotlight residence IDs (maximum 60)' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('rk-editorial-spotlight'));
 SELECT count(*) INTO current_count FROM public.residences WHERE is_spotlight=true;
 IF current_count<>selected_count OR
   (SELECT count(*) FROM public.residences WHERE id=ANY(coalesce(p_ids,ARRAY[]::uuid[])) AND is_spotlight=true)<>selected_count
 THEN RAISE EXCEPTION 'Spotlight selection changed. Refresh before reordering.' USING ERRCODE='40001'; END IF;
 UPDATE public.residences r SET spotlight_rank=u.ord
 FROM unnest(p_ids) WITH ORDINALITY AS u(id,ord)
 WHERE r.id=u.id AND r.is_spotlight=true;
 RETURN selected_count;
END $$;
REVOKE ALL ON FUNCTION public.rk_admin_reorder_spotlight(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rk_admin_reorder_spotlight(uuid[]) TO authenticated;
