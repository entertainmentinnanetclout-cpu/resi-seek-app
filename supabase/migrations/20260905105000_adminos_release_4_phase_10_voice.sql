-- AdminOS Release 4 / Phase 10 — Call Operations + AI Voice Standby
create table if not exists public.adminos_call_queue (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.adminos_prospects(id) on delete set null,
  contact_id uuid not null references public.adminos_contacts(id) on delete cascade,
  purpose text not null default 'service' check(purpose in ('service','application_followup','marketing','partner','appointment','support')),
  mode text not null default 'manual' check(mode in ('manual','ai_voice')),
  priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
  status text not null default 'queued' check(status in ('queued','scheduled','calling','completed','cancelled','blocked')),
  scheduled_for timestamptz not null default now(),
  assigned_to uuid references auth.users(id) on delete set null,
  recommended_reason text,
  attempt_count integer not null default 0 check(attempt_count >= 0),
  max_attempts integer not null default 2 check(max_attempts between 1 and 10),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  blocked_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_adminos_call_queue_due on public.adminos_call_queue(status,scheduled_for,priority);
create index if not exists idx_adminos_call_queue_contact on public.adminos_call_queue(contact_id,created_at desc);
create unique index if not exists uq_adminos_call_queue_active_contact on public.adminos_call_queue(contact_id,purpose) where status in ('queued','scheduled','calling');

create table if not exists public.adminos_calls (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references public.adminos_call_queue(id) on delete set null,
  prospect_id uuid references public.adminos_prospects(id) on delete set null,
  contact_id uuid not null references public.adminos_contacts(id) on delete cascade,
  direction text not null default 'outbound' check(direction in ('outbound','inbound')),
  mode text not null default 'manual' check(mode in ('manual','ai_voice')),
  purpose text not null default 'service' check(purpose in ('service','application_followup','marketing','partner','appointment','support')),
  provider text not null default 'manual' check(provider in ('manual','twilio')),
  from_number text,
  to_number text,
  twilio_call_sid text unique,
  status text not null default 'queued' check(status in ('queued','initiated','ringing','in_progress','completed','busy','failed','no_answer','canceled','blocked')),
  outcome text,
  duration_seconds integer check(duration_seconds is null or duration_seconds >= 0),
  consent_basis text,
  transcript text,
  summary text,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_adminos_calls_contact on public.adminos_calls(contact_id,created_at desc);
create index if not exists idx_adminos_calls_queue on public.adminos_calls(queue_id,created_at desc);
create index if not exists idx_adminos_calls_status on public.adminos_calls(status,created_at desc);

create table if not exists public.adminos_call_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.adminos_calls(id) on delete cascade,
  event_type text not null,
  provider_status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_adminos_call_events_call on public.adminos_call_events(call_id,created_at);

create table if not exists public.adminos_call_turns (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.adminos_calls(id) on delete cascade,
  speaker text not null check(speaker in ('agent','contact','system','staff')),
  content text not null,
  confidence numeric(5,4),
  created_at timestamptz not null default now()
);
create index if not exists idx_adminos_call_turns_call on public.adminos_call_turns(call_id,created_at);

insert into public.platform_settings(key,value,description,updated_at)
values('adminos_voice_settings',jsonb_build_object('enabled',false,'ai_voice_enabled',false,'marketing_calls_enabled',false,'record_calls',false,'manual_calls_primary',true,'max_ai_calls_per_day',20,'quiet_hours',jsonb_build_object('timezone','Africa/Johannesburg','start','20:00','end','08:00'),'require_voice_consent_for_marketing',true,'release',4,'phase',10),'AdminOS Phase 10 voice controls. AI voice and marketing calls are off by default.',now())
on conflict(key) do update set value=excluded.value,description=excluded.description,updated_at=now();

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values('voice_agent','AI Voice Agent',false,'amber',0.950,jsonb_build_object('release',4,'phase',10,'standby',true,'default_enabled',false,'manual_calls_primary',true,'marketing_default_off',true,'record_calls_default',false,'respect_voice_preferences',true,'marketing_requires_consent',true))
on conflict(agent_key) do update set display_name=excluded.display_name,enabled=excluded.enabled,authority_level=excluded.authority_level,confidence_threshold=excluded.confidence_threshold,config=excluded.config,updated_at=now();

insert into public.adminos_integration_connections(provider,display_name,status,enabled,setup_step,setup_url,docs_url,config,secret_refs)
values('twilio_voice','Twilio Programmable Voice','not_connected',false,1,'https://console.twilio.com/','https://www.twilio.com/docs/voice/api/call-resource',jsonb_build_object('release',4,'phase',10,'ai_voice_default_off',true,'marketing_default_off',true,'record_calls_default',false),jsonb_build_object('account_sid_env','TWILIO_ACCOUNT_SID','auth_token_env','TWILIO_AUTH_TOKEN','voice_from_env','TWILIO_VOICE_FROM'))
on conflict(provider) do update set display_name=excluded.display_name,setup_url=excluded.setup_url,docs_url=excluded.docs_url,config=excluded.config,secret_refs=excluded.secret_refs,updated_at=now();

do $$ declare t text; begin foreach t in array array['adminos_call_queue','adminos_calls','adminos_call_events','adminos_call_turns'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists "AdminOS staff access" on public.%I',t);
  execute format('create policy "AdminOS staff access" on public.%I for all to authenticated using ((select public.adminos_is_staff())) with check ((select public.adminos_is_staff()))',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('revoke all on public.%I from anon',t);
end loop; end $$;

drop trigger if exists trg_adminos_call_queue_touch on public.adminos_call_queue;
create trigger trg_adminos_call_queue_touch before update on public.adminos_call_queue for each row execute function public.adminos_touch_updated_at();
drop trigger if exists trg_adminos_calls_touch on public.adminos_calls;
create trigger trg_adminos_calls_touch before update on public.adminos_calls for each row execute function public.adminos_touch_updated_at();

update public.platform_settings
set value=jsonb_set(jsonb_set(jsonb_set(value,'{phase_10}','"implemented_pending_gate"'::jsonb,true),'{current_phase}','10'::jsonb,true),'{phase_11}','"not_started"'::jsonb,true),updated_at=now()
where key='adminos_release_progress';

insert into public.adminos_audit_events(actor_type,action,entity_type,after_state,metadata)
values('system','phase_10.implemented','adminos_release',jsonb_build_object('release',4,'phase',10,'status','implemented_pending_gate','ai_voice_default','off'),'{}'::jsonb);