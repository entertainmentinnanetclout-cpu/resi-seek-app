-- SEC-04 / SEC-05: remove ordinary-browser access to internal admin, AI and WhatsApp jobs.
-- Existing jobs in cron.job run as postgres; Edge webhook/agents use service_role.
-- Do not revoke caller-side virtual tour and Admin Studio RPCs: guard their bodies instead.
-- Verified no public frontend directly calls the 12 functions below; do not change signatures.

REVOKE EXECUTE ON FUNCTION public.adminos_generate_executive_brief(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adminos_generate_executive_brief(date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.adminos_generate_proactive_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adminos_generate_proactive_notifications() TO service_role;

REVOKE EXECUTE ON FUNCTION public.adminos_record_agent_feedback(uuid,uuid,uuid,text,boolean,integer,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adminos_record_agent_feedback(uuid,uuid,uuid,text,boolean,integer,text,text,jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.adminos_record_csat(uuid,integer,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adminos_record_csat(uuid,integer,uuid,text,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.adminos_record_learning_gap(text,uuid,uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adminos_record_learning_gap(text,uuid,uuid,text,text,jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.adminos_refresh_next_best_actions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adminos_refresh_next_best_actions() TO service_role;

REVOKE EXECUTE ON FUNCTION public.adminos_refresh_service_metrics(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adminos_refresh_service_metrics(date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.adminos_refresh_service_recovery() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adminos_refresh_service_recovery() TO service_role;

REVOKE EXECUTE ON FUNCTION public.adminos_set_contact_language(uuid,text,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adminos_set_contact_language(uuid,text,text,numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.adminos_touch_whatsapp_conversion(uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adminos_touch_whatsapp_conversion(uuid,uuid,uuid,text,text,jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.dimpho_compile_persona(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dimpho_compile_persona(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.dimpho_search_knowledge(text,text,integer,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dimpho_search_knowledge(text,text,integer,numeric) TO service_role;

-- Admin Studio read is still callable from authenticated sessions, but only to
-- actual staff with AAL2 MFA (same predicate as existing AdminOS restricted APIs).
CREATE OR REPLACE FUNCTION public.dimpho_intelligence_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $secure$
BEGIN
  IF NOT coalesce(public.adminos_is_staff(),false) THEN
    RAISE EXCEPTION 'Privileged staff MFA required' USING errcode='42501';
  END IF;
  RETURN jsonb_build_object('persona',coalesce((select jsonb_build_object('name',p.name,'role',p.role_title,'active_version',v.version,'published_at',v.published_at) from public.dimpho_personas p left join public.dimpho_persona_versions v on v.id=p.active_version_id where p.persona_key='dimpho'),'{}'::jsonb),'knowledge',jsonb_build_object('documents',(select count(*) from public.dimpho_knowledge_documents where status='published'),'chunks',(select count(*) from public.dimpho_knowledge_chunks),'embedded_chunks',(select count(*) from public.dimpho_knowledge_chunks where embedding is not null),'queued_jobs',(select count(*) from public.dimpho_knowledge_jobs where status='queued')),'app_intelligence',jsonb_build_object('routes',(select count(*) from public.dimpho_app_routes where status in ('active','redirect')),'features',(select count(*) from public.dimpho_app_features where status in ('active','beta')),'workflows',(select count(*) from public.dimpho_app_workflows where status in ('active','beta')),'last_sync',(select max(completed_at) from public.dimpho_app_sync_runs where status in ('succeeded','partial'))),'learning',jsonb_build_object('queued_events',(select count(*) from public.dimpho_conversation_events where status='queued'),'lesson_candidates',(select count(*) from public.dimpho_lesson_candidates where status='candidate'),'auto_promoted',(select count(*) from public.dimpho_lesson_candidates where auto_promoted=true),'training_examples',(select count(*) from public.dimpho_training_examples where active=true)),'settings',(select to_jsonb(s)-'updated_by' from public.dimpho_intelligence_settings s where id=1));
END
$secure$;

-- Handover analysis can return sensitive student integrity details. AAL2 staff only.
CREATE OR REPLACE FUNCTION public.validate_handover_pack(_residence_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s jsonb;
begin
 if not coalesce(public.adminos_is_staff(),false) then
   raise exception 'Privileged staff MFA required' using errcode='42501';
 end if;
  s := public.handover_integrity_scan(_residence_id,'pipeline');
  return s || jsonb_build_object(
    'totals',jsonb_build_object(
      'total_applications',coalesce((s->>'eligible_rows')::int,0),
      'total_students',coalesce((s->>'total_students')::int,0),
      'missing_names',coalesce((s->'issue_counts'->>'missing_name')::int,0),
      'missing_surnames',coalesce((s->'issue_counts'->>'missing_surname')::int,0),
      'missing_student_no',coalesce((s->'issue_counts'->>'missing_identity')::int,0),
      'missing_funding',coalesce((s->'issue_counts'->>'missing_funding')::int,0),
      'invalid_residence',coalesce((s->'issue_counts'->>'invalid_residence')::int,0),
      'duplicates_found',coalesce((s->>'duplicates_found')::int,0)
    ),
    'errors',coalesce((select jsonb_agg(x) from jsonb_array_elements(s->'issues') x where x->>'severity'='error'),'[]'::jsonb)
  );
end;
$function$;

-- Browser-owned and residence-owned tours remain usable after role verification.
CREATE OR REPLACE FUNCTION public.virtual_tour_publish_readiness(p_tour_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_total int; v_ready int; v_below int; v_start int; v_min numeric;
begin
 if auth.role() is distinct from 'service_role'
    and not coalesce(public.virtual_tour_can_manage_tour(p_tour_id),false) then
   raise exception 'Tour owner or authorised residence access required' using errcode='42501';
 end if;
  select coalesce(min_publish_quality,82) into v_min from public.virtual_tour_settings where id=1;
  v_min:=coalesce(v_min,82);
  select count(*),count(*) filter(where status='ready'),count(*) filter(where coalesce(quality_score,0)<v_min),count(*) filter(where is_start=true)
  into v_total,v_ready,v_below,v_start
  from public.virtual_tour_scenes where tour_id=p_tour_id;
  return jsonb_build_object(
    'scene_total',v_total,'ready_scenes',v_ready,'below_quality',v_below,'min_quality',v_min,
    'start_scenes',v_start,'publishable',v_total>0 and v_ready=v_total and v_below=0 and v_start=1
  );
end $function$;

notify pgrst,'reload schema';
