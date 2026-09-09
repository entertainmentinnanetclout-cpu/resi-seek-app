-- Admin operations used by the Dimpho Intelligence Studio.

create or replace function public.dimpho_queue_full_reindex()
returns integer
language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'God Mode AAL2 authentication required' using errcode='42501';
  end if;
  insert into public.dimpho_knowledge_jobs(document_id,job_type,status)
  select d.id,'reindex','queued'
  from public.dimpho_knowledge_documents d
  where d.status='published'
    and not exists (
      select 1 from public.dimpho_knowledge_jobs j
      where j.document_id=d.id and j.status in ('queued','processing')
    );
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
revoke all on function public.dimpho_queue_full_reindex() from public,anon;
grant execute on function public.dimpho_queue_full_reindex() to authenticated;

create or replace function public.dimpho_create_dataset_release(p_name text default null)
returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare
  v_version integer;
  v_count integer;
  v_checksum text;
  v_id uuid;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'God Mode AAL2 authentication required' using errcode='42501';
  end if;
  select coalesce(max(version),0)+1 into v_version from public.dimpho_dataset_releases;
  select count(*) into v_count from public.dimpho_training_examples where active=true;
  select encode(extensions.digest(coalesce(string_agg(id::text||':'||quality_score::text,'|' order by id::text),''),'sha256'),'hex')
    into v_checksum from public.dimpho_training_examples where active=true;
  insert into public.dimpho_dataset_releases(version,name,status,example_count,checksum,filters,metadata,created_by,frozen_at)
  values(v_version,coalesce(nullif(trim(p_name),''),'Dimpho-RK Dataset v'||v_version),'frozen',v_count,v_checksum,jsonb_build_object('active_only',true,'min_quality',0),jsonb_build_object('intelligence_release',4,'pii_policy','redacted_examples_only'),auth.uid(),now())
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id,'version',v_version,'example_count',v_count,'checksum',v_checksum);
end; $$;
revoke all on function public.dimpho_create_dataset_release(text) from public,anon;
grant execute on function public.dimpho_create_dataset_release(text) to authenticated;

create or replace function public.dimpho_promote_lesson(p_candidate_id uuid)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  c public.dimpho_lesson_candidates%rowtype;
  v_example uuid;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'God Mode AAL2 authentication required' using errcode='42501';
  end if;
  select * into c from public.dimpho_lesson_candidates where id=p_candidate_id for update;
  if c.id is null then raise exception 'Lesson candidate not found'; end if;
  if c.sensitive_topic or c.pii_detected then raise exception 'Sensitive or PII-bearing lesson cannot be promoted directly'; end if;
  if coalesce(trim(c.ideal_response),'')='' then raise exception 'Lesson has no ideal response'; end if;
  insert into public.dimpho_training_examples(source_candidate_id,category,channel,user_input,ideal_output,tags,quality_score,provenance,active,metadata)
  values(c.id,c.category,c.source_channel,coalesce(nullif(trim(c.user_excerpt_redacted),''),'Representative ResKonnect user request'),c.ideal_response,array[c.lesson_type,'admin_approved'],greatest(c.quality_score,0.9),'conversation_learning',true,jsonb_build_object('approved_by',auth.uid(),'occurrence_count',c.occurrence_count))
  on conflict(source_candidate_id) do update set ideal_output=excluded.ideal_output,user_input=excluded.user_input,quality_score=excluded.quality_score,active=true,updated_at=now()
  returning id into v_example;
  update public.dimpho_lesson_candidates set status='approved',reviewed_at=now(),reviewed_by=auth.uid() where id=c.id;
  return jsonb_build_object('ok',true,'example_id',v_example,'candidate_id',c.id);
end; $$;
revoke all on function public.dimpho_promote_lesson(uuid) from public,anon;
grant execute on function public.dimpho_promote_lesson(uuid) to authenticated;
