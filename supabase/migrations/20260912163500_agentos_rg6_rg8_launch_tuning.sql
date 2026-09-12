-- RG6-RG8 launch tuning.
-- Prevent legacy backlog blasts and keep occupancy work queues exception-based.

-- Stop the initial pending RG7 launch backlog that has not yet been delivered.
update public.adminos_whatsapp_site_events
set status='cancelled',
    processed_at=coalesce(processed_at,now()),
    last_error='RG7 launch backlog cancelled during rollout tuning',
    updated_at=now()
where idempotency_key like 'rg7-health:%'
  and status in ('pending','waiting_template');

create or replace function public.adminos_rg7_application_operations_cycle()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  rec record;
  health public.adminos_application_health_scores%rowtype;
  recalculated integer:=0;
  reminders integer:=0;
  staff_tasks_created integer:=0;
  v_event_id uuid;
  first_missing jsonb;
  task_kind text;
begin
  for rec in
    select id from public.applications
    where lower(coalesce(status,'')) not in ('rejected','withdrawn','cancelled','declined')
  loop
    perform public.adminos_recalculate_application_health(rec.id);
    recalculated:=recalculated+1;
  end loop;

  perform public.adminos_refresh_next_best_actions();

  -- Staff exceptions are deterministic and unlimited; customer messages are
  -- separately batch-limited below.
  for health in
    select h.*
    from public.adminos_application_health_scores h
    join public.applications a on a.id=h.application_id
    where lower(coalesce(a.status,'')) not in ('approved','rejected','withdrawn','cancelled','declined')
  loop
    if health.automation_state='staff_attention' or health.health_band='blocked' then
      task_kind := case when health.health_band='blocked' then 'application_human_review' else 'application_stale_review' end;
      insert into public.conversion_automation_tasks(
        task_type,source_type,source_id,user_id,owner_scope,status,priority,due_at,summary,payload
      ) values(
        task_kind,'application',health.application_id,health.user_id,'accommodation','pending',
        case when health.health_band='blocked' or health.stale_days>=14 then 'urgent' else 'high' end,
        now()+case when health.health_band='blocked' then interval '4 hours' else interval '24 hours' end,
        case when health.health_band='blocked' then 'Application requires protected staff review'
             else concat('Application stale for ',health.stale_days,' days') end,
        jsonb_build_object(
          'health_score',health.score,'health_band',health.health_band,'stale_days',health.stale_days,
          'missing_items',health.missing_items,'next_action_url',health.next_action_url,
          'department_key','accommodation','release_gate',7
        )
      )
      on conflict (source_type,source_id,task_type) do update set
        status=case when conversion_automation_tasks.status='completed' then 'pending' else conversion_automation_tasks.status end,
        priority=excluded.priority,due_at=excluded.due_at,summary=excluded.summary,payload=excluded.payload,updated_at=now();
      staff_tasks_created:=staff_tasks_created+1;
    end if;
  end loop;

  -- Customer reminders: only statuses where the customer actually has an open
  -- action, max 25 per cycle, minimum 72h between reminders.
  for health in
    select h.*
    from public.adminos_application_health_scores h
    join public.applications a on a.id=h.application_id
    where h.automation_state='customer_action'
      and h.user_id is not null
      and jsonb_array_length(h.missing_items)>0
      and lower(coalesce(a.status,'')) in ('submitted','pending','documents_required')
      and (h.last_reminder_at is null or h.last_reminder_at < now()-interval '72 hours')
    order by h.score asc,coalesce(a.updated_at,a.created_at) desc
    limit 25
  loop
    first_missing := coalesce(health.missing_items->0,'{}'::jsonb);

    insert into public.adminos_whatsapp_site_events(
      event_type,source_table,source_id,user_id,contact_id,payload,status,available_at,idempotency_key
    ) values(
      'document_attention','applications',health.application_id,health.user_id,health.contact_id,
      jsonb_build_object(
        'user_name',coalesce((select full_name from public.profiles where id=health.user_id),'there'),
        'next_step',coalesce(first_missing->>'label','Complete your application'),
        'action_url',coalesce(first_missing->>'url',health.next_action_url,'https://www.reskonnect.org/my-applications'),
        'health_score',health.score,
        'health_band',health.health_band,
        'missing_items',health.missing_items
      ),
      'pending',now(),
      concat('rg7-health:',health.application_id,':',to_char(current_date,'YYYYMMDD'))
    )
    on conflict (idempotency_key) do nothing
    returning id into v_event_id;

    if v_event_id is not null then
      update public.adminos_application_health_scores
      set last_reminder_at=now()
      where application_id=health.application_id;
      reminders:=reminders+1;
    end if;
    v_event_id:=null;
  end loop;

  update public.conversion_automation_tasks t
  set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now()
  where t.source_type='application'
    and t.task_type in ('application_human_review','application_stale_review')
    and t.status='pending'
    and exists(
      select 1 from public.adminos_application_health_scores h
      where h.application_id=t.source_id
        and h.automation_state<>'staff_attention'
        and h.health_band<>'blocked'
    );

  return jsonb_build_object(
    'applications_recalculated',recalculated,
    'customer_reminders_queued',reminders,
    'customer_reminder_batch_limit',25,
    'customer_reminder_cooldown_hours',72,
    'staff_exception_tasks_refreshed',staff_tasks_created,
    'run_at',now()
  );
end;
$$;

revoke all on function public.adminos_rg7_application_operations_cycle() from public,anon,authenticated;
grant execute on function public.adminos_rg7_application_operations_cycle() to service_role;

create or replace function public.adminos_rg8_refresh_occupancy_year(p_academic_year integer)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  affected integer:=0;
  rec record;
  action_key text;
  target_department text;
  task_title text;
begin
  if p_academic_year < 2020 or p_academic_year > 2100 then
    raise exception 'Invalid academic year';
  end if;

  with apps as (
    select residence_id,
      count(*) filter (where lower(coalesce(status,'')) not in ('approved','rejected','withdrawn','cancelled','declined'))::integer active_applications,
      count(distinct user_id) filter (where coalesce(moved_in,false)=true)::integer moved_in_students,
      jsonb_build_object(
        'annual',count(*) filter (where academic_cycle='annual'),
        'semester_1',count(*) filter (where academic_cycle='semester' and academic_period=1),
        'semester_2',count(*) filter (where academic_cycle='semester' and academic_period=2),
        'trimester_1',count(*) filter (where academic_cycle='trimester' and academic_period=1),
        'trimester_2',count(*) filter (where academic_cycle='trimester' and academic_period=2),
        'trimester_3',count(*) filter (where academic_cycle='trimester' and academic_period=3),
        'undergraduate',count(*) filter (where study_level='undergraduate'),
        'postgraduate',count(*) filter (where study_level='postgraduate'),
        'advanced',count(*) filter (where study_level='advanced')
      ) cohort_breakdown
    from public.applications
    where academic_year=p_academic_year and residence_id is not null
    group by residence_id
  ),
  reservations as (
    select residence_id,
      count(*) filter (where lower(coalesce(status,''))<>'cancelled')::integer active_reservations,
      count(*) filter (where lower(coalesce(status,''))='confirmed')::integer confirmed_reservations
    from public.accommodation_reservations
    where academic_year=p_academic_year
    group by residence_id
  ),
  demand as (
    select residence_id,count(distinct user_id)::integer demand_people
    from (
      select residence_id,user_id from public.applications
      where academic_year=p_academic_year and residence_id is not null and user_id is not null
        and lower(coalesce(status,'')) not in ('rejected','withdrawn','cancelled','declined')
      union
      select residence_id,user_id from public.accommodation_reservations
      where academic_year=p_academic_year and user_id is not null
        and lower(coalesce(status,''))<>'cancelled'
    ) d
    group by residence_id
  ),
  calc as (
    select
      i.residence_id,i.academic_year,i.capacity,i.reported_available_beds,i.blocked_beds,
      case when i.reported_available_beds is null then null
           else greatest(i.capacity-i.reported_available_beds-i.blocked_beds,0) end derived_occupied_beds,
      case when i.reported_available_beds is null or i.capacity<=0 then null
           else round((greatest(i.capacity-i.reported_available_beds-i.blocked_beds,0)::numeric/nullif(i.capacity,0))*100,2) end fill_rate,
      coalesce(a.active_applications,0) active_applications,
      coalesce(r.active_reservations,0) active_reservations,
      coalesce(r.confirmed_reservations,0) confirmed_reservations,
      coalesce(a.moved_in_students,0) moved_in_students,
      coalesce(d.demand_people,0) demand_people,
      case when i.reported_available_beds is null then 0
           else greatest(coalesce(d.demand_people,0)-i.reported_available_beds,0) end excess_demand,
      coalesce(a.cohort_breakdown,'{}'::jsonb) cohort_breakdown
    from public.residence_academic_inventory i
    left join apps a on a.residence_id=i.residence_id
    left join reservations r on r.residence_id=i.residence_id
    left join demand d on d.residence_id=i.residence_id
    where i.academic_year=p_academic_year
  )
  insert into public.adminos_occupancy_intelligence(
    residence_id,academic_year,capacity,reported_available_beds,blocked_beds,derived_occupied_beds,fill_rate,
    active_applications,active_reservations,confirmed_reservations,moved_in_students,demand_people,excess_demand,
    cohort_breakdown,intelligence_status,action_priority,recommended_action,department_key,refreshed_at
  )
  select
    c.residence_id,c.academic_year,c.capacity,c.reported_available_beds,c.blocked_beds,c.derived_occupied_beds,c.fill_rate,
    c.active_applications,c.active_reservations,c.confirmed_reservations,c.moved_in_students,c.demand_people,c.excess_demand,
    c.cohort_breakdown,
    case
      when c.reported_available_beds is null then 'inventory_unreported'
      when c.reported_available_beds=0 then 'full'
      when c.excess_demand>0 then 'demand_pressure'
      when c.fill_rate>=85 then 'near_full'
      when c.capacity>0 and c.reported_available_beds::numeric/c.capacity>=0.30 and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 'vacancy_opportunity'
      when c.fill_rate<50 then 'low_fill'
      else 'healthy'
    end,
    case
      when c.reported_available_beds is null and c.demand_people>0 then 95
      when c.excess_demand>0 then 92
      when c.reported_available_beds=0 and c.demand_people>0 then 88
      when c.capacity>0 and c.reported_available_beds::numeric/c.capacity>=0.30 and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 78
      when c.fill_rate<50 then 72
      when c.fill_rate>=85 then 65
      else 35
    end,
    case
      when c.reported_available_beds is null then 'Verify and report this academic year''s inventory before using occupancy for decisions.'
      when c.excess_demand>0 then 'Review demand pressure and route overflow students to verified alternatives before making allocation promises.'
      when c.reported_available_beds=0 then 'Mark demand as constrained and guide new enquiries to verified alternatives.'
      when c.capacity>0 and c.reported_available_beds::numeric/c.capacity>=0.30 and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 'Prepare a vacancy-demand campaign brief for Corporate Affairs; do not auto-publish.'
      when c.fill_rate<50 then 'Investigate low fill, listing quality, price and demand signals.'
      when c.fill_rate>=85 then 'Monitor remaining beds and avoid over-promising availability.'
      else 'No intervention required; continue monitoring.'
    end,
    case
      when c.capacity>0 and c.reported_available_beds is not null
           and c.reported_available_beds::numeric/c.capacity>=0.30
           and c.demand_people<=greatest(2,round(c.capacity*0.10)) then 'marketing_corporate_affairs'
      else 'accommodation'
    end,
    now()
  from calc c
  on conflict(residence_id,academic_year) do update set
    capacity=excluded.capacity,
    reported_available_beds=excluded.reported_available_beds,
    blocked_beds=excluded.blocked_beds,
    derived_occupied_beds=excluded.derived_occupied_beds,
    fill_rate=excluded.fill_rate,
    active_applications=excluded.active_applications,
    active_reservations=excluded.active_reservations,
    confirmed_reservations=excluded.confirmed_reservations,
    moved_in_students=excluded.moved_in_students,
    demand_people=excluded.demand_people,
    excess_demand=excluded.excess_demand,
    cohort_breakdown=excluded.cohort_breakdown,
    intelligence_status=excluded.intelligence_status,
    action_priority=excluded.action_priority,
    recommended_action=excluded.recommended_action,
    department_key=excluded.department_key,
    refreshed_at=now();

  get diagnostics affected=row_count;

  -- Close previous RG8 tasks for this year, then rebuild only the highest-value
  -- exception queue. Intelligence rows remain complete even when no task exists.
  update public.staff_tasks
  set status='completed',updated_at=now(),
      metadata=metadata||jsonb_build_object('resolved_by_rg8_rebuild_at',now())
  where source_table='adminos_occupancy_intelligence'
    and status in ('open','in_progress','waiting')
    and (metadata->>'academic_year')::integer=p_academic_year;

  for rec in
    select ranked.*
    from (
      select o.*,
             row_number() over(
               partition by o.intelligence_status
               order by o.action_priority desc,coalesce(o.reported_available_beds,0) desc,o.demand_people desc
             ) as status_rank
      from public.adminos_occupancy_intelligence o
      where o.academic_year=p_academic_year
    ) ranked
    where ranked.action_priority>=65
      and ranked.intelligence_status in ('inventory_unreported','demand_pressure','full','vacancy_opportunity','low_fill')
      and (
        ranked.intelligence_status in ('inventory_unreported','demand_pressure','full')
        or ranked.status_rank<=20
      )
    order by ranked.action_priority desc,ranked.status_rank
  loop
    action_key:=concat('rg8:',rec.academic_year,':',rec.intelligence_status);
    target_department:=coalesce(rec.department_key,'accommodation');
    task_title:=case rec.intelligence_status
      when 'inventory_unreported' then concat(rec.academic_year,' inventory verification required')
      when 'demand_pressure' then concat(rec.academic_year,' demand exceeds reported open beds')
      when 'full' then concat(rec.academic_year,' residence full — manage overflow demand')
      when 'vacancy_opportunity' then concat(rec.academic_year,' vacancy-demand opportunity')
      when 'low_fill' then concat(rec.academic_year,' low-fill residence review')
      else 'Occupancy action required'
    end;

    insert into public.staff_tasks(
      title,description,source_table,source_id,priority,status,due_at,next_action,tags,metadata,department_key
    ) values(
      task_title,rec.recommended_action,'adminos_occupancy_intelligence',rec.id,
      case when rec.action_priority>=90 then 'urgent' when rec.action_priority>=75 then 'high' else 'normal' end,
      'open',
      now()+case when rec.action_priority>=90 then interval '4 hours' else interval '24 hours' end,
      rec.recommended_action,
      array['rg8','occupancy',rec.intelligence_status,rec.academic_year::text],
      jsonb_build_object(
        'automation_key',action_key,
        'residence_id',rec.residence_id,
        'academic_year',rec.academic_year,
        'fill_rate',rec.fill_rate,
        'reported_available_beds',rec.reported_available_beds,
        'demand_people',rec.demand_people,
        'excess_demand',rec.excess_demand,
        'release_gate',8
      ),
      target_department
    );
  end loop;

  return affected;
end;
$$;

revoke all on function public.adminos_rg8_refresh_occupancy_year(integer) from public,anon,authenticated;
grant execute on function public.adminos_rg8_refresh_occupancy_year(integer) to service_role;

-- Rebuild queues immediately with launch-safe limits.
select public.adminos_rg8_occupancy_cycle();
