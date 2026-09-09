-- Dimpho Intelligence R8 — provider-aware model router, fine-tune pipeline and governed releases.
create table if not exists public.dimpho_models (
 id uuid primary key default gen_random_uuid(), model_key text not null unique, provider text not null, model_name text not null, display_name text not null, purpose text not null default 'reasoning', capabilities jsonb not null default '{}', fine_tunable boolean not null default false, status text not null default 'active' check(status in ('active','candidate','retired','disabled')), metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.dimpho_model_routes (
 id uuid primary key default gen_random_uuid(), route_key text not null unique, model_id uuid not null references public.dimpho_models(id), fallback_model_id uuid references public.dimpho_models(id), enabled boolean not null default true, priority integer not null default 100, config jsonb not null default '{}', updated_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.dimpho_router_decisions (
 id uuid primary key default gen_random_uuid(), agent_run_id uuid references public.adminos_agent_runs(id) on delete set null, route_key text not null, model_id uuid references public.dimpho_models(id), provider text, model_name text, reason text, input_summary jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.dimpho_fine_tune_jobs (
 id uuid primary key default gen_random_uuid(), dataset_release_id uuid references public.dimpho_dataset_releases(id), provider text not null default 'openai', base_model text not null, training_file_id text, provider_job_id text unique, status text not null default 'draft', fine_tuned_model text, error_message text, submitted_by uuid, submitted_at timestamptz, completed_at timestamptz, metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.dimpho_model_releases (
 id uuid primary key default gen_random_uuid(), release_key text not null unique, model_id uuid not null references public.dimpho_models(id), route_key text not null, eval_run_id uuid references public.dimpho_eval_runs(id), status text not null default 'candidate' check(status in ('candidate','canary','production','rolled_back','retired')), traffic_percent integer not null default 0 check(traffic_percent between 0 and 100), previous_release_id uuid references public.dimpho_model_releases(id), promoted_by uuid, promoted_at timestamptz, rolled_back_at timestamptz, metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.dimpho_release_events (
 id uuid primary key default gen_random_uuid(), release_id uuid references public.dimpho_model_releases(id) on delete cascade, event_type text not null, actor_user_id uuid, payload jsonb not null default '{}', created_at timestamptz not null default now()
);
create index if not exists idx_dimpho_router_decisions_run on public.dimpho_router_decisions(agent_run_id,created_at desc);
create index if not exists idx_dimpho_fine_tune_jobs_status on public.dimpho_fine_tune_jobs(status,updated_at desc);
create index if not exists idx_dimpho_model_releases_route on public.dimpho_model_releases(route_key,status,updated_at desc);
insert into public.dimpho_models(model_key,provider,model_name,display_name,purpose,capabilities,fine_tunable,status,metadata) values
('openai_routine','openai','gpt-5.6-luna','GPT-5.6 Luna','routine','{"responses":true,"embeddings":false}',false,'active','{"release":8,"source":"current_agent"}'),
('openai_complex','openai','gpt-5.6-terra','GPT-5.6 Terra','complex','{"responses":true}',false,'active','{"release":8,"source":"current_agent"}'),
('lovable_fallback','lovable_gateway','google/gemini-2.5-flash','Gemini 2.5 Flash via Lovable','fallback','{"chat_completions":true}',false,'active','{"release":8}'),
('openai_training_base','openai','gpt-4.1-mini','OpenAI Fine-tuning Base','training_base','{"fine_tune_candidate":true}',true,'active','{"release":8,"configurable":true,"do_not_submit_without_cost_approval":true}')
on conflict(model_key) do update set provider=excluded.provider,model_name=excluded.model_name,display_name=excluded.display_name,purpose=excluded.purpose,capabilities=excluded.capabilities,fine_tunable=excluded.fine_tunable,status=excluded.status,metadata=excluded.metadata,updated_at=now();
insert into public.dimpho_model_routes(route_key,model_id,fallback_model_id,enabled,priority,config)
select 'routine',r.id,f.id,true,100,'{"release":8,"max_output_tokens":850}' from public.dimpho_models r,public.dimpho_models f where r.model_key='openai_routine' and f.model_key='lovable_fallback'
on conflict(route_key) do update set model_id=excluded.model_id,fallback_model_id=excluded.fallback_model_id,enabled=true,config=excluded.config,updated_at=now();
insert into public.dimpho_model_routes(route_key,model_id,fallback_model_id,enabled,priority,config)
select 'complex',r.id,f.id,true,100,'{"release":8,"max_output_tokens":1100}' from public.dimpho_models r,public.dimpho_models f where r.model_key='openai_complex' and f.model_key='lovable_fallback'
on conflict(route_key) do update set model_id=excluded.model_id,fallback_model_id=excluded.fallback_model_id,enabled=true,config=excluded.config,updated_at=now();
insert into public.dimpho_model_routes(route_key,model_id,fallback_model_id,enabled,priority,config)
select 'training_base',r.id,null,true,100,'{"release":8,"requires_explicit_cost_approval":true}' from public.dimpho_models r where r.model_key='openai_training_base'
on conflict(route_key) do update set model_id=excluded.model_id,enabled=true,config=excluded.config,updated_at=now();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('dimpho-model-artifacts','dimpho-model-artifacts',false,10485760,array['application/json','application/jsonl','text/plain']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
alter table public.dimpho_models enable row level security;
alter table public.dimpho_model_routes enable row level security;
alter table public.dimpho_router_decisions enable row level security;
alter table public.dimpho_fine_tune_jobs enable row level security;
alter table public.dimpho_model_releases enable row level security;
alter table public.dimpho_release_events enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='dimpho_models' and policyname='dimpho_models_staff_read') then create policy dimpho_models_staff_read on public.dimpho_models for select to authenticated using(public.adminos_is_staff()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='dimpho_model_routes' and policyname='dimpho_model_routes_staff_read') then create policy dimpho_model_routes_staff_read on public.dimpho_model_routes for select to authenticated using(public.adminos_is_staff()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='dimpho_router_decisions' and policyname='dimpho_router_staff_read') then create policy dimpho_router_staff_read on public.dimpho_router_decisions for select to authenticated using(public.adminos_is_staff()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='dimpho_fine_tune_jobs' and policyname='dimpho_ft_staff_read') then create policy dimpho_ft_staff_read on public.dimpho_fine_tune_jobs for select to authenticated using(public.adminos_is_staff()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='dimpho_model_releases' and policyname='dimpho_releases_staff_read') then create policy dimpho_releases_staff_read on public.dimpho_model_releases for select to authenticated using(public.adminos_is_staff()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='dimpho_release_events' and policyname='dimpho_release_events_staff_read') then create policy dimpho_release_events_staff_read on public.dimpho_release_events for select to authenticated using(public.adminos_is_staff()); end if;
end $$;
create or replace function public.dimpho_model_router_snapshot(p_route_key text) returns jsonb language sql security definer set search_path=public as $$
 select coalesce((select jsonb_build_object('route_key',r.route_key,'model_id',m.id,'model_key',m.model_key,'provider',m.provider,'model_name',m.model_name,'fallback_model_id',fm.id,'fallback_model_key',fm.model_key,'fallback_provider',fm.provider,'fallback_model_name',fm.model_name,'config',r.config) from public.dimpho_model_routes r join public.dimpho_models m on m.id=r.model_id left join public.dimpho_models fm on fm.id=r.fallback_model_id where r.route_key=p_route_key and r.enabled=true and m.status in ('active','candidate') limit 1),'{}'::jsonb);
$$;
grant execute on function public.dimpho_model_router_snapshot(text) to authenticated,service_role;
update public.dimpho_intelligence_settings set release_state=coalesce(release_state,'{}')||'{"release_8":"active","model_router":"active","fine_tune_pipeline":"ready_not_submitted"}'::jsonb,updated_at=now() where id=1;
