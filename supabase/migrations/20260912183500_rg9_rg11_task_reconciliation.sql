-- RG9-RG11 task reconciliation hardening.
-- One task per meaningful source state; cron refreshes no longer close/recreate identical work.

create or replace function public.adminos_rg9_reconcile_tasks()
returns integer
language plpgsql security definer set search_path=public as $$
declare rec record; k text; current_count integer:=0;
begin
  update public.staff_tasks
  set status='completed',updated_at=now(),metadata=metadata||jsonb_build_object('automation_resolved_at',now())
  where department_key='student_opportunities'
    and status in ('open','in_progress','waiting')
    and coalesce(metadata->>'automation_family','')='rg9'
    and (
      metadata->>'automation_key' is null
      or (
        source_table='adminos_student_opportunity_cases'
        and not exists(
          select 1 from public.adminos_student_opportunity_cases c
          where c.id=staff_tasks.source_id
            and c.automation_state='staff_attention'
            and concat('rg9:case:',c.id,':',c.automation_state,':',c.source_status,':',c.readiness_band)=staff_tasks.metadata->>'automation_key'
        )
      )
      or (
        source_table='adminos_opportunity_catalog_health'
        and not exists(
          select 1 from public.adminos_opportunity_catalog_health h
          where h.id=staff_tasks.source_id
            and h.health_state in ('needs_verification','incomplete','closing_soon')
            and h.public_state in ('active','published')
            and concat('rg9:catalog:',h.id,':',h.health_state,':',h.public_state)=staff_tasks.metadata->>'automation_key'
        )
      )
    );

  for rec in
    select * from public.adminos_student_opportunity_cases
    where automation_state='staff_attention'
    order by priority desc,stale_days desc
    limit 50
  loop
    k:=concat('rg9:case:',rec.id,':',rec.automation_state,':',rec.source_status,':',rec.readiness_band);
    if not exists(select 1 from public.staff_tasks where metadata->>'automation_key'=k) then
      insert into public.staff_tasks(
        title,description,source_table,source_id,user_id,priority,status,due_at,next_action,tags,metadata,department_key
      ) values(
        case when rec.case_type='wil' then 'WIL case needs attention' else 'Student opportunity case needs attention' end,
        concat(coalesce(rec.programme,'Student service'),' · ',rec.source_status,' · stale ',rec.stale_days,' day(s)'),
        'adminos_student_opportunity_cases',rec.id,rec.user_id,
        case when rec.priority>=90 then 'urgent' when rec.priority>=75 then 'high' else 'normal' end,
        'open',now()+case when rec.priority>=90 then interval '4 hours' else interval '24 hours' end,
        rec.next_best_action,array['rg9','student-opportunities',rec.case_type],
        jsonb_build_object('automation_family','rg9','automation_key',k,'case_type',rec.case_type,'source_type',rec.source_type,'source_id',rec.source_id,'readiness_score',rec.readiness_score,'stale_days',rec.stale_days),
        'student_opportunities'
      );
    else
      update public.staff_tasks set
        description=concat(coalesce(rec.programme,'Student service'),' · ',rec.source_status,' · stale ',rec.stale_days,' day(s)'),
        priority=case when rec.priority>=90 then 'urgent' when rec.priority>=75 then 'high' else 'normal' end,
        next_action=rec.next_best_action,
        metadata=metadata||jsonb_build_object('readiness_score',rec.readiness_score,'stale_days',rec.stale_days,'last_refresh_at',now()),
        updated_at=now()
      where metadata->>'automation_key'=k and status in ('open','in_progress','waiting');
    end if;
  end loop;

  for rec in
    select * from public.adminos_opportunity_catalog_health
    where health_state in ('needs_verification','incomplete','closing_soon')
      and public_state in ('active','published')
    order by case health_state when 'needs_verification' then 1 when 'incomplete' then 2 else 3 end,deadline nulls last
    limit 25
  loop
    k:=concat('rg9:catalog:',rec.id,':',rec.health_state,':',rec.public_state);
    if not exists(select 1 from public.staff_tasks where metadata->>'automation_key'=k) then
      insert into public.staff_tasks(
        title,description,source_table,source_id,priority,status,due_at,next_action,tags,metadata,department_key
      ) values(
        concat('Opportunity catalog: ',rec.health_state),rec.title,'adminos_opportunity_catalog_health',rec.id,
        case when rec.health_state='needs_verification' then 'high' else 'normal' end,'open',
        now()+case when rec.health_state='closing_soon' then interval '8 hours' else interval '24 hours' end,
        rec.recommended_action,array['rg9','catalog',rec.source_type,rec.health_state],
        jsonb_build_object('automation_family','rg9','automation_key',k,'source_type',rec.source_type,'source_id',rec.source_id,'quality_score',rec.quality_score,'deadline',rec.deadline),
        'student_opportunities'
      );
    else
      update public.staff_tasks set next_action=rec.recommended_action,
        metadata=metadata||jsonb_build_object('quality_score',rec.quality_score,'deadline',rec.deadline,'last_refresh_at',now()),updated_at=now()
      where metadata->>'automation_key'=k and status in ('open','in_progress','waiting');
    end if;
  end loop;

  select count(*)::integer into current_count from public.staff_tasks
  where department_key='student_opportunities' and status in ('open','in_progress','waiting')
    and metadata->>'automation_family'='rg9';
  return current_count;
end;
$$;

create or replace function public.adminos_rg9_student_opportunities_cycle()
returns jsonb
language plpgsql security definer set search_path=public as $$
declare rec record;wil_cases integer:=0;support_cases integer:=0;matches integer:=0;task_count integer:=0;catalog_result jsonb;
begin
  catalog_result:=public.adminos_rg9_refresh_catalog();
  for rec in select id from public.wil_applications loop perform public.adminos_rg9_refresh_wil_case(rec.id);wil_cases:=wil_cases+1;end loop;
  for rec in select id from public.application_support_queries loop perform public.adminos_rg9_refresh_support_case(rec.id);support_cases:=support_cases+1;end loop;
  matches:=public.adminos_rg9_refresh_matches();
  task_count:=public.adminos_rg9_reconcile_tasks();
  return jsonb_build_object('wil_cases',wil_cases,'application_support_cases',support_cases,'potential_matches_refreshed',matches,'department_tasks',task_count,'catalog',catalog_result,'run_at',now());
end;
$$;

create or replace function public.adminos_rg10_reconcile_tasks()
returns integer
language plpgsql security definer set search_path=public as $$
declare rec record;k text;current_count integer:=0;
begin
  update public.staff_tasks
  set status='completed',updated_at=now(),metadata=metadata||jsonb_build_object('automation_resolved_at',now())
  where department_key='partnerships_engagements'
    and status in ('open','in_progress','waiting')
    and coalesce(metadata->>'automation_family','')='rg10'
    and (
      metadata->>'automation_key' is null
      or (
        source_table='adminos_partnership_lead_intelligence'
        and not exists(
          select 1 from public.adminos_partnership_lead_intelligence i
          where i.id=staff_tasks.source_id and i.automation_state in ('follow_up','qualified','executive_review')
            and concat('rg10:lead:',i.partner_lead_id,':',i.automation_state,':',i.source_status)=staff_tasks.metadata->>'automation_key'
        )
      )
      or (
        source_table='adminos_partnership_relationship_health'
        and not exists(
          select 1 from public.adminos_partnership_relationship_health h
          where h.id=staff_tasks.source_id and h.automation_state in ('follow_up','executive_review')
            and concat('rg10:relationship:',h.partner_id,':',h.automation_state,':',h.health_band)=staff_tasks.metadata->>'automation_key'
        )
      )
    );

  for rec in
    select i.*,l.organisation_name,l.contact_name
    from public.adminos_partnership_lead_intelligence i join public.partner_leads l on l.id=i.partner_lead_id
    where i.automation_state in ('follow_up','qualified','executive_review')
    order by i.priority desc,i.lead_score desc limit 50
  loop
    k:=concat('rg10:lead:',rec.partner_lead_id,':',rec.automation_state,':',rec.source_status);
    if not exists(select 1 from public.staff_tasks where metadata->>'automation_key'=k) then
      insert into public.staff_tasks(
        title,description,source_table,source_id,priority,status,due_at,next_action,contact_name,tags,metadata,department_key
      ) values(
        concat('Partner lead: ',coalesce(rec.organisation_name,rec.lead_type)),
        concat(rec.source_status,' · score ',rec.lead_score,'/100 · stale ',rec.stale_days,' day(s)'),
        'adminos_partnership_lead_intelligence',rec.id,
        case when rec.priority>=90 then 'urgent' when rec.priority>=75 then 'high' else 'normal' end,'open',
        now()+case when rec.priority>=90 then interval '4 hours' else interval '24 hours' end,
        rec.next_best_action,rec.contact_name,array['rg10','partnerships','lead',rec.lead_type],
        jsonb_build_object('automation_family','rg10','automation_key',k,'partner_lead_id',rec.partner_lead_id,'lead_score',rec.lead_score,'automation_state',rec.automation_state),
        'partnerships_engagements'
      );
    else
      update public.staff_tasks set description=concat(rec.source_status,' · score ',rec.lead_score,'/100 · stale ',rec.stale_days,' day(s)'),
        next_action=rec.next_best_action,metadata=metadata||jsonb_build_object('lead_score',rec.lead_score,'stale_days',rec.stale_days,'last_refresh_at',now()),updated_at=now()
      where metadata->>'automation_key'=k and status in ('open','in_progress','waiting');
    end if;
  end loop;

  for rec in
    select h.*,p.name,p.partnership_type
    from public.adminos_partnership_relationship_health h join public.partnerships p on p.id=h.partner_id
    where h.automation_state in ('follow_up','executive_review')
    order by h.priority desc,h.days_since_activity desc limit 30
  loop
    k:=concat('rg10:relationship:',rec.partner_id,':',rec.automation_state,':',rec.health_band);
    if not exists(select 1 from public.staff_tasks where metadata->>'automation_key'=k) then
      insert into public.staff_tasks(
        title,description,source_table,source_id,priority,status,due_at,next_action,tags,metadata,department_key
      ) values(
        concat('Partnership health: ',rec.name),
        concat(rec.health_band,' · relationship score ',rec.relationship_score,'/100 · ',rec.days_since_activity,' day(s) since activity'),
        'adminos_partnership_relationship_health',rec.id,
        case when rec.priority>=90 then 'urgent' when rec.priority>=75 then 'high' else 'normal' end,'open',
        now()+case when rec.priority>=90 then interval '8 hours' else interval '48 hours' end,
        rec.next_best_action,array['rg10','partnerships','relationship',rec.health_band],
        jsonb_build_object('automation_family','rg10','automation_key',k,'partner_id',rec.partner_id,'relationship_score',rec.relationship_score,'health_band',rec.health_band,'partnership_type',rec.partnership_type),
        'partnerships_engagements'
      );
    else
      update public.staff_tasks set description=concat(rec.health_band,' · relationship score ',rec.relationship_score,'/100 · ',rec.days_since_activity,' day(s) since activity'),
        next_action=rec.next_best_action,metadata=metadata||jsonb_build_object('relationship_score',rec.relationship_score,'days_since_activity',rec.days_since_activity,'last_refresh_at',now()),updated_at=now()
      where metadata->>'automation_key'=k and status in ('open','in_progress','waiting');
    end if;
  end loop;

  select count(*)::integer into current_count from public.staff_tasks
  where department_key='partnerships_engagements' and status in ('open','in_progress','waiting')
    and metadata->>'automation_family'='rg10';
  return current_count;
end;
$$;

create or replace function public.adminos_rg10_partnerships_cycle()
returns jsonb
language plpgsql security definer set search_path=public as $$
declare rec record;leads integer:=0;relationships integer:=0;drafts integer:=0;tasks integer:=0;
begin
  for rec in select id from public.partner_leads loop perform public.adminos_rg10_sync_partner_lead(rec.id);leads:=leads+1;end loop;
  relationships:=public.adminos_rg10_refresh_relationships();
  drafts:=public.adminos_rg10_prepare_drafts();
  tasks:=public.adminos_rg10_reconcile_tasks();
  return jsonb_build_object('partner_leads_synced',leads,'relationships_refreshed',relationships,'followup_drafts',drafts,'department_tasks',tasks,'run_at',now());
end;
$$;

create or replace function public.adminos_rg11_reconcile_tasks()
returns integer
language plpgsql security definer set search_path=public as $$
declare rec record;k text;current_count integer:=0;
begin
  update public.staff_tasks
  set status='completed',updated_at=now(),metadata=metadata||jsonb_build_object('automation_resolved_at',now())
  where department_key='marketing_corporate_affairs'
    and status in ('open','in_progress','waiting')
    and coalesce(metadata->>'automation_family','')='rg11'
    and (
      metadata->>'automation_key' is null
      or not exists(
        select 1 from public.adminos_corporate_affairs_briefs b
        where b.id=staff_tasks.source_id and b.status='open' and b.risk_level in ('amber','red')
          and concat('rg11:brief:',b.brief_key,':',b.risk_level)=staff_tasks.metadata->>'automation_key'
      )
    );

  for rec in
    select * from public.adminos_corporate_affairs_briefs
    where status='open' and risk_level in ('amber','red')
    order by case risk_level when 'red' then 1 else 2 end,signal_count desc
  loop
    k:=concat('rg11:brief:',rec.brief_key,':',rec.risk_level);
    if not exists(select 1 from public.staff_tasks where metadata->>'automation_key'=k) then
      insert into public.staff_tasks(
        title,description,source_table,source_id,priority,status,due_at,next_action,tags,metadata,department_key
      ) values(
        concat('Reputation brief: ',rec.headline),rec.summary,'adminos_corporate_affairs_briefs',rec.id,
        case when rec.risk_level='red' then 'urgent' else 'high' end,'open',
        now()+case when rec.risk_level='red' then interval '4 hours' else interval '24 hours' end,
        rec.recommended_action,array['rg11','corporate-affairs',rec.brief_type,rec.risk_level],
        jsonb_build_object('automation_family','rg11','automation_key',k,'brief_key',rec.brief_key,'risk_level',rec.risk_level,'signal_count',rec.signal_count,'public_statement_recommended',rec.public_statement_recommended),
        'marketing_corporate_affairs'
      );
    else
      update public.staff_tasks set description=rec.summary,next_action=rec.recommended_action,
        metadata=metadata||jsonb_build_object('signal_count',rec.signal_count,'public_statement_recommended',rec.public_statement_recommended,'last_refresh_at',now()),updated_at=now()
      where metadata->>'automation_key'=k and status in ('open','in_progress','waiting');
    end if;
  end loop;

  select count(*)::integer into current_count from public.staff_tasks
  where department_key='marketing_corporate_affairs' and status in ('open','in_progress','waiting')
    and metadata->>'automation_family'='rg11';
  return current_count;
end;
$$;

create or replace function public.adminos_rg11_reputation_cycle()
returns jsonb
language plpgsql security definer set search_path=public as $$
declare signals integer:=0;briefs integer:=0;drafts integer:=0;tasks integer:=0;
begin
  signals:=public.adminos_rg11_refresh_signals();
  briefs:=public.adminos_rg11_refresh_briefs();
  drafts:=public.adminos_rg11_prepare_drafts();
  tasks:=public.adminos_rg11_reconcile_tasks();
  return jsonb_build_object('signals_refreshed',signals,'briefs_refreshed',briefs,'drafts_prepared',drafts,'department_tasks',tasks,'run_at',now());
end;
$$;

-- Prime once: legacy unkeyed tasks are closed and replaced by stable keyed tasks.
select public.adminos_rg9_student_opportunities_cycle();
select public.adminos_rg10_partnerships_cycle();
select public.adminos_rg11_reputation_cycle();
