-- RG14 failed-run contract monitoring hardening.
create or replace function public.adminos_rg14_refresh_incidents()
returns integer language plpgsql security definer set search_path=public as $$
declare rec record;k text;active_keys text[]:='{}'::text[];n integer:=0;cnt integer:=0;
begin
  for rec in
    select e.*,j.jobid,j.active,j.schedule
    from public.adminos_reliability_expectations e
    left join cron.job j on e.expectation_type='cron' and j.jobname=e.target_key
    where e.enabled and e.expectation_type='cron' and (j.jobid is null or not coalesce(j.active,false))
  loop
    k:=concat('rg14:missing-cron:',rec.target_key);active_keys:=array_append(active_keys,k);
    perform public.adminos_rg14_upsert_incident(k,'scheduler','missing_expected_cron',
      case when rec.criticality='critical' then 'critical' when rec.criticality='high' then 'high' else 'medium' end,
      1,jsonb_build_object('jobname',rec.target_key,'criticality',rec.criticality,'schedule',rec.schedule),
      'Restore the expected scheduler job only after verifying the release configuration and function target.');
  end loop;

  for rec in
    select e.target_key,e.criticality,c.status,c.enabled,c.last_success_at,c.last_error_at,c.last_error
    from public.adminos_reliability_expectations e
    left join public.adminos_integration_connections c on e.expectation_type='integration' and c.provider=e.target_key
    where e.enabled and e.expectation_type='integration'
      and (c.id is null or not coalesce(c.enabled,false) or coalesce(c.status,'not_connected')<>'connected')
  loop
    k:=concat('rg14:integration:',rec.target_key);active_keys:=array_append(active_keys,k);
    perform public.adminos_rg14_upsert_incident(k,'integrations','required_integration_unhealthy',
      case when rec.criticality='critical' then 'critical' when rec.criticality='high' then 'high' else 'medium' end,
      1,jsonb_build_object('provider',rec.target_key,'status',rec.status,'enabled',rec.enabled,'last_success_at',rec.last_success_at,'last_error_at',rec.last_error_at,'last_error',rec.last_error),
      'Verify provider credentials/connectivity and run its health check. Do not rotate credentials automatically.');
  end loop;

  for rec in
    select coalesce(r.agent_key,'unknown') agent_key,count(*)::integer total,min(r.started_at) oldest
    from public.adminos_agent_runs r
    where r.status='running' and r.started_at<now()-interval '30 minutes'
    group by coalesce(r.agent_key,'unknown')
  loop
    k:=concat('rg14:stuck-agent:',rec.agent_key);active_keys:=array_append(active_keys,k);
    perform public.adminos_rg14_upsert_incident(k,'agents','stuck_agent_run',
      case when rec.oldest<now()-interval '2 hours' then 'high' else 'medium' end,
      rec.total,jsonb_build_object('agent_key',rec.agent_key,'oldest_started_at',rec.oldest),
      'Inspect the run and dependency state. Do not retry state-changing tools until idempotency is confirmed.');
  end loop;

  for rec in
    select coalesce(e.error_code,'unknown') error_code,count(*)::integer total,max(e.created_at) latest,
           bool_or(e.retryable) retryable
    from public.adminos_agent_errors e
    where not e.resolved and e.created_at>=now()-interval '24 hours'
    group by coalesce(e.error_code,'unknown')
  loop
    k:=concat('rg14:agent-error:',rec.error_code);active_keys:=array_append(active_keys,k);
    perform public.adminos_rg14_upsert_incident(k,'agents','unresolved_agent_error',
      case when rec.total>=10 then 'critical' when rec.total>=3 then 'high' else 'medium' end,
      rec.total,jsonb_build_object('error_code',rec.error_code,'latest_at',rec.latest,'retryable',rec.retryable),
      'Trace the failing agent/run and correct the root cause before retrying. Production code changes remain release-gated.');
  end loop;

  for rec in
    select agent_key,count(*)::integer total,max(started_at) latest
    from public.adminos_agent_runs
    where status='failed' and started_at>=now()-interval '24 hours'
      and not (coalesce(output->>'reconciled','false')='true')
    group by agent_key
  loop
    k:=concat('rg14:failed-run:',rec.agent_key);active_keys:=array_append(active_keys,k);
    perform public.adminos_rg14_upsert_incident(k,'agents','failed_agent_runs',
      case when rec.total>=10 then 'critical' when rec.total>=3 then 'high' else 'medium' end,
      rec.total,jsonb_build_object('agent_key',rec.agent_key,'failed_runs_24h',rec.total,'latest_failed_at',rec.latest),
      'Inspect the most recent failed run output and correct the deterministic contract or dependency before the next scheduled cycle.');
  end loop;

  select count(*)::integer into cnt from public.adminos_automation_events
  where status in ('new','failed','blocked') and created_at<now()-interval '30 minutes';
  if cnt>0 then
    k:='rg14:stale-automation-events';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg14_upsert_incident(k,'automation','stale_automation_events',
      case when cnt>=50 then 'critical' when cnt>=10 then 'high' else 'medium' end,cnt,
      jsonb_build_object('count',cnt,'age_threshold_minutes',30),
      'Inspect event consumers and blocked dependencies; preserve event records until processing is verified.');
  end if;

  select count(*)::integer into cnt from public.seo_index_queue
  where status='failed' and attempts>=3;
  if cnt>0 then
    k:='rg14:indexing-repeated-failures';active_keys:=array_append(active_keys,k);
    perform public.adminos_rg14_upsert_incident(k,'search','indexing_repeated_failures',
      case when cnt>=25 then 'high' else 'medium' end,cnt,jsonb_build_object('failed_after_retries',cnt),
      'Inspect IndexNow transport failures and canonical URL generation before requeueing.');
  end if;

  update public.adminos_reliability_incidents
  set status='resolved',resolved_at=now(),last_seen_at=now()
  where status in ('open','monitoring') and incident_key like 'rg14:%' and not(incident_key=any(active_keys));

  select count(*)::integer into n from public.adminos_reliability_incidents where status='open' and incident_key like 'rg14:%';
  return n;
end;
$$;

select public.adminos_rg14_reliability_cycle();
select public.adminos_rg15_executive_cycle();
