-- AdminOS Release 4 / Phase 11 — Executive Agent
create table if not exists public.adminos_executive_briefs (
  id uuid primary key default gen_random_uuid(), brief_date date not null default current_date, period_start timestamptz not null, period_end timestamptz not null,
  headline text not null, summary text not null, metrics jsonb not null default '{}'::jsonb, attention jsonb not null default '[]'::jsonb, recommendations jsonb not null default '[]'::jsonb,
  generated_by_type text not null default 'system' check(generated_by_type in ('system','scheduler','staff','agent')), generated_by_id uuid references auth.users(id) on delete set null,
  provider text, model text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists idx_adminos_executive_briefs_date on public.adminos_executive_briefs(brief_date desc,created_at desc);

create table if not exists public.adminos_executive_commands (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, command text not null, normalized_intent text,
  status text not null default 'completed' check(status in ('running','completed','failed','blocked')), result jsonb not null default '{}'::jsonb, provider text, model text, latency_ms integer, created_at timestamptz not null default now()
);
create index if not exists idx_adminos_executive_commands_created on public.adminos_executive_commands(created_at desc);

create table if not exists public.adminos_executive_alerts (
  id uuid primary key default gen_random_uuid(), alert_key text not null unique, severity text not null default 'medium' check(severity in ('low','medium','high','critical')),
  title text not null, description text not null, status text not null default 'open' check(status in ('open','acknowledged','resolved')), entity_type text, entity_id uuid,
  current_count integer not null default 0, due_at timestamptz, acknowledged_by uuid references auth.users(id) on delete set null, acknowledged_at timestamptz, resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_adminos_executive_alerts_status on public.adminos_executive_alerts(status,severity,updated_at desc);

create or replace function public.adminos_refresh_executive_alerts()
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare pending_approvals integer:=0; unresolved_errors integer:=0; overdue_hot integer:=0; overdue_calls integer:=0; escalated_comms integer:=0; integrations_attention integer:=0; awaiting_docs integer:=0;
begin
  select count(*) into pending_approvals from public.adminos_approval_requests where status='pending';
  select count(*) into unresolved_errors from public.adminos_agent_errors where resolved=false and created_at>=now()-interval '24 hours';
  select count(*) into overdue_hot from public.adminos_prospects where score>=80 and automation_state='eligible' and next_action_at is not null and next_action_at<now();
  select count(*) into overdue_calls from public.adminos_call_queue where status in ('queued','scheduled') and coalesce(next_attempt_at,scheduled_for)<now()-interval '2 hours';
  select ((select count(*) from public.adminos_whatsapp_threads where status='escalated')+(select count(*) from public.adminos_enquiry_threads where status in ('escalated','open') and priority in ('high','urgent'))+(select count(*) from public.adminos_email_threads where status='escalated')) into escalated_comms;
  select count(*) into integrations_attention from public.adminos_integration_connections where status in ('needs_action','error','disconnected','not_connected');
  select count(*) into awaiting_docs from public.adminos_company_documents where status='awaiting_approval';

  insert into public.adminos_executive_alerts(alert_key,severity,title,description,status,current_count,metadata,updated_at,resolved_at)
  values('approvals.pending',case when pending_approvals>=10 then 'critical' when pending_approvals>=3 then 'high' else 'medium' end,'Approvals need a decision',pending_approvals||' AdminOS approval request(s) are pending.',case when pending_approvals>0 then 'open' else 'resolved' end,pending_approvals,'{"source":"approval_requests"}'::jsonb,now(),case when pending_approvals=0 then now() else null end)
  on conflict(alert_key) do update set severity=excluded.severity,description=excluded.description,status=case when excluded.current_count>0 and adminos_executive_alerts.status='resolved' then 'open' else excluded.status end,current_count=excluded.current_count,metadata=excluded.metadata,updated_at=now(),resolved_at=excluded.resolved_at;

  insert into public.adminos_executive_alerts(alert_key,severity,title,description,status,current_count,metadata,updated_at,resolved_at)
  values('agent.errors','high','Agent errors need attention',unresolved_errors||' unresolved agent error(s) occurred in the last 24 hours.',case when unresolved_errors>0 then 'open' else 'resolved' end,unresolved_errors,'{"source":"agent_errors"}'::jsonb,now(),case when unresolved_errors=0 then now() else null end)
  on conflict(alert_key) do update set description=excluded.description,status=case when excluded.current_count>0 and adminos_executive_alerts.status='resolved' then 'open' else excluded.status end,current_count=excluded.current_count,updated_at=now(),resolved_at=excluded.resolved_at;

  insert into public.adminos_executive_alerts(alert_key,severity,title,description,status,current_count,metadata,updated_at,resolved_at)
  values('sales.hot_overdue','high','Hot prospects are overdue',overdue_hot||' high-intent prospect(s) have an overdue next action.',case when overdue_hot>0 then 'open' else 'resolved' end,overdue_hot,'{"source":"prospects"}'::jsonb,now(),case when overdue_hot=0 then now() else null end)
  on conflict(alert_key) do update set description=excluded.description,status=case when excluded.current_count>0 and adminos_executive_alerts.status='resolved' then 'open' else excluded.status end,current_count=excluded.current_count,updated_at=now(),resolved_at=excluded.resolved_at;

  insert into public.adminos_executive_alerts(alert_key,severity,title,description,status,current_count,metadata,updated_at,resolved_at)
  values('calls.overdue','medium','Call queue is overdue',overdue_calls||' call queue item(s) are overdue.',case when overdue_calls>0 then 'open' else 'resolved' end,overdue_calls,'{"source":"call_queue"}'::jsonb,now(),case when overdue_calls=0 then now() else null end)
  on conflict(alert_key) do update set description=excluded.description,status=case when excluded.current_count>0 and adminos_executive_alerts.status='resolved' then 'open' else excluded.status end,current_count=excluded.current_count,updated_at=now(),resolved_at=excluded.resolved_at;

  insert into public.adminos_executive_alerts(alert_key,severity,title,description,status,current_count,metadata,updated_at,resolved_at)
  values('communications.escalated','high','Communications need a human',escalated_comms||' high-priority or escalated conversation(s) need human handling.',case when escalated_comms>0 then 'open' else 'resolved' end,escalated_comms,'{"source":"communications"}'::jsonb,now(),case when escalated_comms=0 then now() else null end)
  on conflict(alert_key) do update set description=excluded.description,status=case when excluded.current_count>0 and adminos_executive_alerts.status='resolved' then 'open' else excluded.status end,current_count=excluded.current_count,updated_at=now(),resolved_at=excluded.resolved_at;

  insert into public.adminos_executive_alerts(alert_key,severity,title,description,status,current_count,metadata,updated_at,resolved_at)
  values('integrations.needs_action','medium','Integrations need setup or reconnection',integrations_attention||' integration(s) need setup or reconnection.',case when integrations_attention>0 then 'open' else 'resolved' end,integrations_attention,'{"source":"integration_connections"}'::jsonb,now(),case when integrations_attention=0 then now() else null end)
  on conflict(alert_key) do update set description=excluded.description,status=case when excluded.current_count>0 and adminos_executive_alerts.status='resolved' then 'open' else excluded.status end,current_count=excluded.current_count,updated_at=now(),resolved_at=excluded.resolved_at;

  insert into public.adminos_executive_alerts(alert_key,severity,title,description,status,current_count,metadata,updated_at,resolved_at)
  values('documents.awaiting_approval','medium','Documents are waiting for approval',awaiting_docs||' company document(s) are awaiting approval.',case when awaiting_docs>0 then 'open' else 'resolved' end,awaiting_docs,'{"source":"company_documents"}'::jsonb,now(),case when awaiting_docs=0 then now() else null end)
  on conflict(alert_key) do update set description=excluded.description,status=case when excluded.current_count>0 and adminos_executive_alerts.status='resolved' then 'open' else excluded.status end,current_count=excluded.current_count,updated_at=now(),resolved_at=excluded.resolved_at;

  return jsonb_build_object('pending_approvals',pending_approvals,'unresolved_errors',unresolved_errors,'overdue_hot_prospects',overdue_hot,'overdue_calls',overdue_calls,'escalated_communications',escalated_comms,'integrations_attention',integrations_attention,'documents_awaiting_approval',awaiting_docs);
end;
$$;
revoke all on function public.adminos_refresh_executive_alerts() from public,anon,authenticated;
grant execute on function public.adminos_refresh_executive_alerts() to service_role;

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values('executive_agent','Executive Agent',true,'green',0.950,jsonb_build_object('release',4,'phase',11,'read_only_by_default',true,'data_grounded',true,'financial_commitments','human_only','legal_commitments','human_only','contract_signing','human_only','daily_brief',true,'provider_fallback',true))
on conflict(agent_key) do update set display_name=excluded.display_name,enabled=excluded.enabled,authority_level=excluded.authority_level,confidence_threshold=excluded.confidence_threshold,config=excluded.config,updated_at=now();

insert into public.adminos_scheduler_secrets(secret_key,secret_value) values('executive_agent',encode(gen_random_bytes(32),'hex')) on conflict(secret_key) do nothing;

do $$ declare t text; begin foreach t in array array['adminos_executive_briefs','adminos_executive_commands','adminos_executive_alerts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists "AdminOS staff access" on public.%I',t);
  execute format('create policy "AdminOS staff access" on public.%I for all to authenticated using ((select public.adminos_is_staff())) with check ((select public.adminos_is_staff()))',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('revoke all on public.%I from anon',t);
end loop; end $$;

drop trigger if exists trg_adminos_executive_alerts_touch on public.adminos_executive_alerts;
create trigger trg_adminos_executive_alerts_touch before update on public.adminos_executive_alerts for each row execute function public.adminos_touch_updated_at();

select public.adminos_refresh_executive_alerts();

do $$ declare existing bigint; begin
  select jobid into existing from cron.job where jobname='adminos-executive-alerts' limit 1;
  if existing is not null then perform cron.unschedule(existing); end if;
  perform cron.schedule('adminos-executive-alerts','5 * * * *','select public.adminos_refresh_executive_alerts();');
end $$;

do $$ declare existing bigint; begin
  select jobid into existing from cron.job where jobname='adminos-executive-brief' limit 1;
  if existing is not null then perform cron.unschedule(existing); end if;
  perform cron.schedule('adminos-executive-brief','0 4 * * *',$cron$
    select net.http_post(url:='https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/adminos-executive',headers:=jsonb_build_object('Content-Type','application/json','x-adminos-cron-token',(select secret_value from public.adminos_scheduler_secrets where secret_key='executive_agent')),body:='{"action":"brief","source":"pg_cron"}'::jsonb,timeout_milliseconds:=30000);
  $cron$);
end $$;

update public.platform_settings set value=jsonb_build_object('release',4,'total_phases',12,'completed_phases',jsonb_build_array(0,1,2,3,4,5,6,7,8),'current_phase',11,'release_status','gate_running','release_gate_4','running','phase_0','complete','phase_1','complete','phase_2','complete','phase_3','complete','phase_4','complete','phase_5','complete','phase_6','complete','phase_7','complete','phase_8','complete','phase_9','implemented_pending_gate','phase_10','implemented_pending_gate','phase_11','implemented_pending_gate'),description='ResKonnect AdminOS final release progress. Release Gate 4 covers phases 9-11.',updated_at=now() where key='adminos_release_progress';

insert into public.adminos_audit_events(actor_type,action,entity_type,after_state,metadata)
values('system','release_gate_4.implementation_started','adminos_release',jsonb_build_object('release',4,'phases',jsonb_build_array(9,10,11),'status','gate_running'),jsonb_build_object('source','production_migration'));