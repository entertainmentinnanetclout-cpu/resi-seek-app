-- Academic cohort intelligence for Luna automation.
-- Keeps annual/semester/trimester and study-level demand visible to the
-- campaign planner without conflating it with physical bed inventory.

create or replace function public.luna_academic_cohort_demand(
  p_academic_year integer default extract(year from current_date)::integer,
  p_days integer default 90
)
returns table(
  campus_key text,
  academic_cycle text,
  academic_period smallint,
  study_level text,
  application_count bigint,
  reservation_count bigint,
  total_signal_count bigint
)
language sql stable security definer set search_path=public
as $function$
with app as (
  select
    public.housing_intel_campus_key(r.campus) as campus_key,
    a.academic_cycle,
    a.academic_period,
    a.study_level,
    count(*)::bigint as application_count
  from public.applications a
  join public.residences r on r.id=a.residence_id
  where a.academic_year=p_academic_year
    and a.created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730)))
  group by 1,2,3,4
), resv as (
  select
    public.housing_intel_campus_key(r.campus) as campus_key,
    ar.academic_cycle,
    ar.academic_period,
    ar.study_level,
    count(*)::bigint as reservation_count
  from public.accommodation_reservations ar
  join public.residences r on r.id=ar.residence_id
  where ar.academic_year=p_academic_year
    and ar.status<>'cancelled'
    and ar.created_at>=now()-make_interval(days=>greatest(1,least(coalesce(p_days,90),730)))
  group by 1,2,3,4
), keys as (
  select campus_key,academic_cycle,academic_period,study_level from app
  union
  select campus_key,academic_cycle,academic_period,study_level from resv
)
select
  k.campus_key,
  coalesce(k.academic_cycle,'unspecified') as academic_cycle,
  coalesce(k.academic_period,0)::smallint as academic_period,
  coalesce(k.study_level,'unspecified') as study_level,
  coalesce(a.application_count,0)::bigint as application_count,
  coalesce(r.reservation_count,0)::bigint as reservation_count,
  (coalesce(a.application_count,0)+coalesce(r.reservation_count,0))::bigint as total_signal_count
from keys k
left join app a using(campus_key,academic_cycle,academic_period,study_level)
left join resv r using(campus_key,academic_cycle,academic_period,study_level)
order by total_signal_count desc,campus_key,academic_cycle,academic_period,study_level;
$function$;

revoke all on function public.luna_academic_cohort_demand(integer,integer) from public,anon;
grant execute on function public.luna_academic_cohort_demand(integer,integer) to authenticated,service_role;

-- Keep current academic year highly responsive and next-year intake visible
-- without letting the two years share occupancy or demand state.
do $$
declare jid bigint;
begin
  for jid in
    select jobid from cron.job
    where jobname in ('luna-next-year-demand-cycle','luna-next-year-content-cycle')
  loop
    perform cron.unschedule(jid);
  end loop;

  perform cron.schedule(
    'luna-next-year-demand-cycle',
    '35 * * * *',
    $cron$select net.http_post(
      url := 'https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/luna-orchestrator',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-luna-cron-token',(select secret_value from public.adminos_scheduler_secrets where secret_key='luna_demand')
      ),
      body := jsonb_build_object(
        'action','demand_cycle',
        'academic_year',extract(year from current_date)::integer+1,
        'days',90,
        'source','supabase_cron_next_year'
      ),
      timeout_milliseconds := 120000
    );$cron$
  );

  perform cron.schedule(
    'luna-next-year-content-cycle',
    '47 */6 * * *',
    $cron$select net.http_post(
      url := 'https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/luna-orchestrator',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-luna-cron-token',(select secret_value from public.adminos_scheduler_secrets where secret_key='luna_content')
      ),
      body := jsonb_build_object(
        'action','content_cycle',
        'academic_year',extract(year from current_date)::integer+1,
        'source','supabase_cron_next_year'
      ),
      timeout_milliseconds := 120000
    );$cron$
  );
end $$;
