-- P0 ResKonnect: prevent repeated no-op writes and duplicate staff tasks
-- External Supabase project mefjzkhobkltlbmhusdh; non-destructive.
-- Backed by pg_stat_statements WAL measurements and 219k duplicate RG8 tasks.
-- No user records, reservations, role grants, or cron histories are deleted.
-- Core resmap/reskonnect room-hold expiry and customer-message workers unaffected.

CREATE OR REPLACE FUNCTION public.adminos_prospect_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- An UPDATE that sets the same score, stage and priority must not emit
  -- another prospect.updated event (reduces queued event storms).
  if tg_op='UPDATE' then
    if (new.stage,new.score,new.priority)
       is not distinct from (old.stage,old.score,old.priority) then
      return new;
    end if;
  end if;

  insert into public.adminos_automation_events(event_type,entity_type,entity_id,contact_id,payload,correlation_id)
  values(case when tg_op='INSERT' then 'prospect.created' else 'prospect.updated' end,'prospect',new.id,new.contact_id,jsonb_build_object('pipeline',new.pipeline,'stage',new.stage,'score',new.score,'priority',new.priority),'prospect:'||new.id::text);
  return new;
end; $function$


CREATE OR REPLACE FUNCTION public.adminos_rg8_refresh_occupancy_year(p_academic_year integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Prevent concurrent cycle invocations from racing to create the same work.
  if not pg_try_advisory_xact_lock(81408,p_academic_year) then
    return 0;
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
    refreshed_at=now()
  -- Do not produce WAL and trigger work for the same unchanged inventory.
  where (
      adminos_occupancy_intelligence.capacity,
      adminos_occupancy_intelligence.reported_available_beds,
      adminos_occupancy_intelligence.blocked_beds,
      adminos_occupancy_intelligence.derived_occupied_beds,
      adminos_occupancy_intelligence.fill_rate,
      adminos_occupancy_intelligence.active_applications,
      adminos_occupancy_intelligence.active_reservations,
      adminos_occupancy_intelligence.confirmed_reservations,
      adminos_occupancy_intelligence.moved_in_students,
      adminos_occupancy_intelligence.demand_people,
      adminos_occupancy_intelligence.excess_demand,
      adminos_occupancy_intelligence.cohort_breakdown,
      adminos_occupancy_intelligence.intelligence_status,
      adminos_occupancy_intelligence.action_priority,
      adminos_occupancy_intelligence.recommended_action,
      adminos_occupancy_intelligence.department_key
    ) is distinct from (
      excluded.capacity,
      excluded.reported_available_beds,
      excluded.blocked_beds,
      excluded.derived_occupied_beds,
      excluded.fill_rate,
      excluded.active_applications,
      excluded.active_reservations,
      excluded.confirmed_reservations,
      excluded.moved_in_students,
      excluded.demand_people,
      excluded.excess_demand,
      excluded.cohort_breakdown,
      excluded.intelligence_status,
      excluded.action_priority,
      excluded.recommended_action,
      excluded.department_key
    );

  get diagnostics affected=row_count;

  -- Resolve only tasks whose occupancy condition has changed or disappeared.
  -- Preserve active staff work when the same exception persists.
  update public.staff_tasks t
  set status='completed',
      updated_at=now(),
      metadata=coalesce(t.metadata,'{}'::jsonb)
        || jsonb_build_object('resolved_by_rg8_state_change_at',now())
  from public.adminos_occupancy_intelligence o
  where t.source_table='adminos_occupancy_intelligence'
    and t.source_id=o.id
    and t.status in ('open','in_progress','waiting')
    and o.academic_year=p_academic_year
    and (
      o.action_priority < 65
      or o.intelligence_status not in ('inventory_unreported','demand_pressure','full','vacancy_opportunity','low_fill')
      or t.metadata->>'automation_key' is distinct from concat('rg8:',o.academic_year,':',o.intelligence_status)
    );

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

    -- Deduplicate by residence/year/status. A completed task does not
    -- regenerate on every polling cycle; older resolved exceptions may
    -- be reconsidered after a 30-day cooldown.
    if exists (
      select 1 from public.staff_tasks existing
      where existing.source_table='adminos_occupancy_intelligence'
        and existing.source_id=rec.id
        and existing.metadata->>'automation_key'=action_key
        and (
          existing.status in ('open','in_progress','waiting')
          or existing.created_at >= now()-interval '30 days'
        )
    ) then
      continue;
    end if;

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
$function$


-- Load-shed noncritical *batch* jobs. Interactive application and Auth
-- flows remain active. Up to 30-120 min freshness delay is intentional.
DO $$
DECLARE item record; job record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('adminos-next-best-action-refresh', '1-59/5 * * * *', '1,31 * * * *'),
    ('adminos-proactive-whatsapp', '2-59/5 * * * *', '7,37 * * * *'),
    ('adminos-rg7-application-operations', '11-59/15 * * * *', '11 * * * *'),
    ('adminos-rg8-occupancy-intelligence', '19-59/30 * * * *', '19 * * * *'),
    ('adminos-rg9-student-opportunities', '14-59/20 * * * *', '14 */2 * * *'),
    ('adminos-rg10-partnerships', '16-59/30 * * * *', '16 */2 * * *'),
    ('adminos-rg11-reputation', '9-59/15 * * * *', '9 * * * *')
  ) AS v(name,old_schedule,new_schedule) LOOP
    SELECT jobid,schedule,username,active INTO job FROM cron.job WHERE jobname=item.name;
    IF NOT FOUND OR job.username <> 'postgres' OR NOT job.active THEN
      RAISE EXCEPTION 'Unexpected job owner/state: %',item.name;
    END IF;
    IF job.schedule=item.new_schedule THEN CONTINUE; END IF;
    IF job.schedule<>item.old_schedule THEN
      RAISE EXCEPTION 'Unexpected cron schedule for %: %, review required',item.name,job.schedule;
    END IF;
    PERFORM cron.alter_job(job_id:=job.jobid,schedule:=item.new_schedule);
  END LOOP;
END $$;
