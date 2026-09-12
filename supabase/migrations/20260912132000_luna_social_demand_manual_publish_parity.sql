-- Repository parity for the live Luna RG3-RG5 social-demand/manual-publish layer.
-- Metricool is demand intelligence only. Luna may prepare drafts, never auto-publish.

create table if not exists public.adminos_social_demand_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  provider text not null default 'metricool',
  brand_id text,
  network text not null check (network in ('instagram','tiktok','facebook','youtube','linkedin','threads','x','pinterest','google_business')),
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  top_content jsonb not null default '[]'::jsonb,
  best_times jsonb not null default '[]'::jsonb,
  demand_score numeric not null default 0 check (demand_score between 0 and 100),
  demand_signal text not null default 'low' check (demand_signal in ('low','monitor','rising','strong')),
  source text not null default 'manual_verified_import' check (source in ('metricool_connector','metricool_api','manual_verified_import')),
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (period_end >= period_start)
);

alter table public.adminos_social_demand_snapshots enable row level security;
drop policy if exists adminos_social_demand_snapshots_staff_read on public.adminos_social_demand_snapshots;
create policy adminos_social_demand_snapshots_staff_read on public.adminos_social_demand_snapshots
for select to authenticated using (public.get_user_staff_role(auth.uid()) is not null);
drop policy if exists adminos_social_demand_snapshots_admin_manage on public.adminos_social_demand_snapshots;
create policy adminos_social_demand_snapshots_admin_manage on public.adminos_social_demand_snapshots
for all to authenticated using (public.is_reskonnect_admin(auth.uid())) with check (public.is_reskonnect_admin(auth.uid()));

alter table public.adminos_social_posts
  add column if not exists manual_publish_required boolean not null default true,
  add column if not exists recommended_publish_at timestamptz,
  add column if not exists manual_published_at timestamptz,
  add column if not exists manual_published_by uuid references auth.users(id) on delete set null,
  add column if not exists demand_snapshot_id uuid references public.adminos_social_demand_snapshots(id) on delete set null,
  add column if not exists posting_notes text;

insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values
('luna_content','Luna · Content Intelligence',true,'green',0.90,
 jsonb_build_object('release',1,'release_gate',3,'content_generation',true,'campaign_creation',true,'publishing',false,'manual_publish_required',true,'metricool_role','social_demand_analysis','fact_validation',true,'primary_provider','openai','primary_model','gpt-5.6-luna')),
('luna_social_demand','Luna · Social Demand Intelligence',true,'green',0.95,
 jsonb_build_object('release',1,'release_gate',4,'provider','metricool','brand_id','6910625','timezone','Africa/Johannesburg','networks',jsonb_build_array('facebook','instagram','tiktok','youtube'),'analysis_enabled',true,'publishing',false,'manual_posting',true))
on conflict(agent_key) do update set
  display_name=excluded.display_name,
  enabled=excluded.enabled,
  authority_level=excluded.authority_level,
  confidence_threshold=excluded.confidence_threshold,
  config=coalesce(public.adminos_agent_config.config,'{}'::jsonb)||excluded.config,
  updated_at=now();

update public.adminos_agent_config
set config=coalesce(config,'{}'::jsonb)||jsonb_build_object(
  'metricool_role','social_demand_analysis',
  'publishing',false,
  'manual_publish_required',true
),updated_at=now()
where agent_key in ('luna_demand','luna_content');

create or replace function public.enforce_luna_manual_social_publish()
returns trigger language plpgsql set search_path=public as $$
begin
  if coalesce(new.manual_publish_required,true)=true
     and coalesce(new.provider,'manual') <> 'manual'
     and new.status in ('queued','scheduled','published') then
    raise exception 'Autonomous social publishing is disabled. Founder/manual posting is required.';
  end if;
  return new;
end $$;
revoke all on function public.enforce_luna_manual_social_publish() from public,anon,authenticated;
drop trigger if exists trg_enforce_luna_manual_social_publish on public.adminos_social_posts;
create trigger trg_enforce_luna_manual_social_publish
before insert or update on public.adminos_social_posts
for each row execute function public.enforce_luna_manual_social_publish();

comment on table public.adminos_social_demand_snapshots is 'Metricool and verified social analytics used by Luna as social demand intelligence. This table does not authorize publishing.';
comment on column public.adminos_social_posts.manual_publish_required is 'True means Luna can prepare the post but the founder/user must publish manually unless an explicit later instruction changes policy.';
