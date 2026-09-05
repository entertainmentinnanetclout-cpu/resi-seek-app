-- AdminOS Release 4 / Phase 9 — Prospect CRM + Sales Automation
create extension if not exists pgcrypto;

grant execute on function public.adminos_is_staff() to authenticated;
revoke execute on function public.adminos_is_staff() from anon;

alter table public.adminos_prospects
  add column if not exists lead_value numeric(12,2) not null default 0,
  add column if not exists probability numeric(5,2) not null default 0,
  add column if not exists response_state text not null default 'unknown',
  add column if not exists last_response_at timestamptz,
  add column if not exists qualified_at timestamptz,
  add column if not exists converted_at timestamptz,
  add column if not exists automation_state text not null default 'eligible',
  add column if not exists temperature text not null default 'cold';

alter table public.adminos_prospects drop constraint if exists adminos_prospects_probability_check;
alter table public.adminos_prospects add constraint adminos_prospects_probability_check check(probability >= 0 and probability <= 100);
alter table public.adminos_prospects drop constraint if exists adminos_prospects_response_state_check;
alter table public.adminos_prospects add constraint adminos_prospects_response_state_check check(response_state in ('unknown','never_contacted','awaiting_reply','replied','engaged','inactive','do_not_contact'));
alter table public.adminos_prospects drop constraint if exists adminos_prospects_automation_state_check;
alter table public.adminos_prospects add constraint adminos_prospects_automation_state_check check(automation_state in ('eligible','paused','blocked','completed'));
alter table public.adminos_prospects drop constraint if exists adminos_prospects_temperature_check;
alter table public.adminos_prospects add constraint adminos_prospects_temperature_check check(temperature in ('cold','warm','hot'));

create index if not exists idx_adminos_prospects_sales_queue on public.adminos_prospects(pipeline,stage,score desc,next_action_at);
create index if not exists idx_adminos_prospects_priority_score on public.adminos_prospects(priority,score desc);
create index if not exists idx_adminos_prospects_next_action on public.adminos_prospects(next_action_at) where next_action_at is not null;

create table if not exists public.adminos_pipeline_events (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.adminos_prospects(id) on delete cascade,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  event_type text not null,
  from_stage text,
  to_stage text,
  score_before numeric,
  score_after numeric,
  actor_type text not null default 'system' check(actor_type in ('system','agent','staff','scheduler')),
  actor_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_adminos_pipeline_events_prospect on public.adminos_pipeline_events(prospect_id,created_at desc);
create index if not exists idx_adminos_pipeline_events_created on public.adminos_pipeline_events(created_at desc);

create table if not exists public.adminos_lead_score_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  name text not null,
  description text,
  weight numeric not null default 0,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.adminos_lead_score_rules(rule_key,name,description,weight,enabled,metadata)
values
('contactable_email','Contact has email','Adds score when an email address is available.',5,true,'{"phase":9,"release":4}'::jsonb),
('contactable_phone','Contact has phone','Adds score when a phone number is available.',5,true,'{"phase":9,"release":4}'::jsonb),
('application_exists','Application exists','Applicant intent demonstrated through a ResKonnect application.',20,true,'{"phase":9,"release":4}'::jsonb),
('application_active','Application active','Application is still progressing through a live workflow.',15,true,'{"phase":9,"release":4}'::jsonb),
('application_approved','Application approved','Strong conversion signal.',20,true,'{"phase":9,"release":4}'::jsonb),
('documents_uploaded','Documents uploaded','Adds up to fifteen points based on application document progress.',15,true,'{"phase":9,"release":4}'::jsonb),
('recent_reply','Recent inbound response','Recent contact response or enquiry.',15,true,'{"phase":9,"release":4}'::jsonb),
('stale_followup','Stale follow-up','Reduces score when the prospect has been contacted but has not responded for two weeks.',-10,true,'{"phase":9,"release":4}'::jsonb),
('do_not_contact','Do not contact','Forces score to zero and blocks automation.',-100,true,'{"phase":9,"release":4}'::jsonb)
on conflict(rule_key) do update set name=excluded.name,description=excluded.description,weight=excluded.weight,enabled=excluded.enabled,metadata=excluded.metadata,updated_at=now();

create or replace function public.adminos_recalculate_prospect_score(p_prospect_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  r record;
  pref_do_not_contact boolean := false;
  pref_voice_allowed boolean := true;
  pref_email_allowed boolean := true;
  pref_whatsapp_allowed boolean := true;
  app_count integer := 0;
  active_app_count integer := 0;
  approved_app_count integer := 0;
  doc_count integer := 0;
  old_score numeric := 0;
  new_score numeric := 0;
  last_inbound timestamptz;
  new_priority text := 'low';
  new_temperature text := 'cold';
  new_response_state text := 'unknown';
  new_automation_state text := 'eligible';
  new_probability numeric := 0;
  delta numeric := 0;
begin
  select p.*, c.profile_user_id, c.email, c.phone into r
  from public.adminos_prospects p join public.adminos_contacts c on c.id=p.contact_id
  where p.id=p_prospect_id;
  if not found then raise exception 'prospect_not_found'; end if;
  old_score := coalesce(r.score,0);

  select coalesce(do_not_contact,false),coalesce(voice_allowed,true),coalesce(email_allowed,true),coalesce(whatsapp_allowed,true)
  into pref_do_not_contact,pref_voice_allowed,pref_email_allowed,pref_whatsapp_allowed
  from public.adminos_communication_preferences where contact_id=r.contact_id limit 1;
  if not found then pref_do_not_contact := false; pref_voice_allowed := true; pref_email_allowed := true; pref_whatsapp_allowed := true; end if;

  if r.email is not null and btrim(r.email) <> '' then new_score := new_score + 5; end if;
  if r.phone is not null and btrim(r.phone) <> '' then new_score := new_score + 5; end if;

  if r.profile_user_id is not null then
    select count(*),count(*) filter(where status in ('submitted','under_review','documents_required','conditionally_approved','approved')),count(*) filter(where status='approved')
    into app_count,active_app_count,approved_app_count from public.applications where user_id=r.profile_user_id;
    if app_count > 0 then new_score := new_score + 20; end if;
    if active_app_count > 0 then new_score := new_score + 15; end if;
    if approved_app_count > 0 then new_score := new_score + 20; end if;
    select count(*) into doc_count from public.application_documents d join public.applications a on a.id=d.application_id where a.user_id=r.profile_user_id and coalesce(d.status,'') <> 'rejected';
    new_score := new_score + least(15, doc_count * 3);
  end if;

  select max(x.ts) into last_inbound from (
    select max(created_at) as ts from public.adminos_whatsapp_messages where contact_id=r.contact_id and direction='inbound'
    union all select max(created_at) from public.adminos_email_messages where contact_id=r.contact_id and direction='inbound'
    union all select max(last_message_at) from public.adminos_enquiry_threads where contact_id=r.contact_id
  ) x;

  if last_inbound is not null and last_inbound >= now() - interval '14 days' then new_score := new_score + 15; new_response_state := 'replied';
  elsif last_inbound is not null and last_inbound >= now() - interval '30 days' then new_score := new_score + 8; new_response_state := 'engaged';
  elsif r.last_contacted_at is null then new_response_state := 'never_contacted';
  elsif r.last_contacted_at < now() - interval '14 days' then new_score := new_score - 10; new_response_state := 'inactive';
  else new_response_state := 'awaiting_reply'; end if;

  new_score := new_score + case r.stage when 'contacted' then 5 when 'qualified' then 15 when 'interested' then 20 when 'application_started' then 25 when 'documents_pending' then 30 when 'lease_pending' then 25 when 'ready' then 35 when 'approved' then 40 when 'converted' then 100 when 'onboarded' then 100 else 0 end;
  if r.stage in ('lost','not_interested','invalid','do_not_contact') then new_score := 0; end if;
  if pref_do_not_contact or (not pref_voice_allowed and not pref_email_allowed and not pref_whatsapp_allowed) then new_automation_state := 'blocked'; end if;
  if pref_do_not_contact then new_score := 0; new_response_state := 'do_not_contact';
  elsif r.stage in ('converted','onboarded','lost','not_interested','invalid','do_not_contact') then new_automation_state := 'completed';
  elsif r.automation_state='paused' then new_automation_state := 'paused'; end if;

  new_score := greatest(0,least(100,new_score));
  new_probability := new_score;
  new_priority := case when new_score >= 85 then 'urgent' when new_score >= 70 then 'high' when new_score >= 40 then 'normal' else 'low' end;
  new_temperature := case when new_score >= 80 then 'hot' when new_score >= 60 then 'warm' else 'cold' end;
  delta := new_score-old_score;

  update public.adminos_prospects set score=new_score,probability=new_probability,priority=new_priority,temperature=new_temperature,response_state=new_response_state,last_response_at=coalesce(last_inbound,last_response_at),automation_state=new_automation_state,qualified_at=case when new_score >= 70 then coalesce(qualified_at,now()) else qualified_at end,converted_at=case when stage in ('converted','onboarded') then coalesce(converted_at,now()) else converted_at end,updated_at=now() where id=p_prospect_id;
  if delta <> 0 then
    insert into public.adminos_lead_scores(prospect_id,score_delta,reason,rule_key,metadata) values(p_prospect_id,delta,'Release 4 deterministic composite score','release4_composite_score',jsonb_build_object('old_score',old_score,'new_score',new_score,'application_count',app_count,'document_count',doc_count,'last_inbound',last_inbound));
    insert into public.adminos_pipeline_events(prospect_id,contact_id,event_type,score_before,score_after,actor_type,payload) values(p_prospect_id,r.contact_id,'lead_score.recalculated',old_score,new_score,'system',jsonb_build_object('priority',new_priority,'temperature',new_temperature,'response_state',new_response_state));
  end if;
  return jsonb_build_object('prospect_id',p_prospect_id,'old_score',old_score,'score',new_score,'priority',new_priority,'temperature',new_temperature,'response_state',new_response_state,'automation_state',new_automation_state,'application_count',app_count,'document_count',doc_count);
end;
$$;

create or replace function public.adminos_recalculate_all_prospects(p_limit integer default 1000)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_id uuid; processed integer:=0; changed integer:=0; before_score numeric; after_score numeric;
begin
  for v_id in select id from public.adminos_prospects order by updated_at asc limit greatest(1,least(coalesce(p_limit,1000),5000)) loop
    select score into before_score from public.adminos_prospects where id=v_id;
    perform public.adminos_recalculate_prospect_score(v_id);
    select score into after_score from public.adminos_prospects where id=v_id;
    processed:=processed+1; if coalesce(before_score,0)<>coalesce(after_score,0) then changed:=changed+1; end if;
  end loop;
  return jsonb_build_object('processed',processed,'changed',changed,'release',4,'phase',9);
end;
$$;
revoke all on function public.adminos_recalculate_prospect_score(uuid) from public,anon,authenticated;
revoke all on function public.adminos_recalculate_all_prospects(integer) from public,anon,authenticated;
grant execute on function public.adminos_recalculate_prospect_score(uuid) to service_role;
grant execute on function public.adminos_recalculate_all_prospects(integer) to service_role;

create or replace view public.adminos_sales_pipeline_v with (security_invoker=true) as
select p.id,p.contact_id,p.organization_id,p.pipeline,p.stage,p.score,p.priority,p.temperature,p.probability,p.lead_value,p.response_state,p.automation_state,p.next_action,p.next_action_at,p.last_contacted_at,p.last_response_at,p.owner_id,p.source_type,p.source_id,p.created_at,p.updated_at,c.full_name,c.email,c.phone,c.campus,c.student_number,coalesce(cp.do_not_contact,false) as do_not_contact,coalesce(cp.marketing_allowed,false) as marketing_allowed,coalesce(cp.voice_allowed,true) as voice_allowed,coalesce(cp.email_allowed,true) as email_allowed,coalesce(cp.whatsapp_allowed,true) as whatsapp_allowed
from public.adminos_prospects p join public.adminos_contacts c on c.id=p.contact_id left join public.adminos_communication_preferences cp on cp.contact_id=p.contact_id;

alter table public.adminos_pipeline_events enable row level security;
alter table public.adminos_lead_score_rules enable row level security;
drop policy if exists "AdminOS staff access" on public.adminos_pipeline_events;
create policy "AdminOS staff access" on public.adminos_pipeline_events for all to authenticated using ((select public.adminos_is_staff())) with check ((select public.adminos_is_staff()));
drop policy if exists "AdminOS staff read" on public.adminos_lead_score_rules;
create policy "AdminOS staff read" on public.adminos_lead_score_rules for select to authenticated using ((select public.adminos_is_staff()));
grant select,insert,update,delete on public.adminos_pipeline_events to authenticated;
grant select on public.adminos_lead_score_rules to authenticated;
grant all on public.adminos_pipeline_events,public.adminos_lead_score_rules to service_role;
revoke all on public.adminos_pipeline_events,public.adminos_lead_score_rules from anon;
revoke all on public.adminos_contacts,public.adminos_contact_channels,public.adminos_prospects,public.adminos_lead_scores,public.adminos_organizations,public.adminos_organization_contacts from anon;
grant select on public.adminos_sales_pipeline_v to authenticated,service_role;

drop trigger if exists trg_adminos_lead_score_rules_touch on public.adminos_lead_score_rules;
create trigger trg_adminos_lead_score_rules_touch before update on public.adminos_lead_score_rules for each row execute function public.adminos_touch_updated_at();

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values('sales_agent','Sales & CRM Agent',true,'green',0.950,jsonb_build_object('release',4,'phase',9,'deterministic_scoring',true,'auto_contact',false,'respect_consent',true,'respect_do_not_contact',true))
on conflict(agent_key) do update set display_name=excluded.display_name,enabled=excluded.enabled,authority_level=excluded.authority_level,confidence_threshold=excluded.confidence_threshold,config=excluded.config,updated_at=now();

select public.adminos_recalculate_all_prospects(5000);

do $$ declare existing bigint; begin select jobid into existing from cron.job where jobname='adminos-lead-scoring' limit 1; if existing is not null then perform cron.unschedule(existing); end if; perform cron.schedule('adminos-lead-scoring','15 */6 * * *','select public.adminos_recalculate_all_prospects(5000);'); end $$;

insert into public.platform_settings(key,value,description,updated_at)
values('adminos_release_progress',jsonb_build_object('release',4,'total_phases',12,'completed_phases',jsonb_build_array(0,1,2,3,4,5,6,7,8),'current_phase',9,'release_status','gate_running','release_gate_4','running','phase_0','complete','phase_1','complete','phase_2','complete','phase_3','complete','phase_4','complete','phase_5','complete','phase_6','complete','phase_7','complete','phase_8','complete','phase_9','implemented_pending_gate','phase_10','not_started','phase_11','not_started'),'ResKonnect AdminOS final release progress. Release Gate 4 covers phases 9-11.',now())
on conflict(key) do update set value=excluded.value,description=excluded.description,updated_at=now();
insert into public.adminos_audit_events(actor_type,action,entity_type,after_state,metadata) values('system','phase_9.implemented','adminos_release',jsonb_build_object('release',4,'phase',9,'status','implemented_pending_gate'),jsonb_build_object('source','production_migration','auto_contact',false));