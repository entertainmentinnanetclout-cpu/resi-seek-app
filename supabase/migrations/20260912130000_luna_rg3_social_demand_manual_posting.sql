-- Luna AgentOS RG3 — Social Demand Intelligence + Founder Manual Posting
-- Metricool is analytics-only by default. Luna may analyse and prepare content,
-- but publishing is blocked unless a founder-authorized manual action is recorded.

create table if not exists public.adminos_social_demand_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'metricool',
  brand_id text,
  period_start timestamptz not null,
  period_end timestamptz not null,
  network text not null,
  source_mode text not null default 'analytics' check (source_mode in ('analytics','manual_import','api_sync','mcp_sync')),
  metrics jsonb not null default '{}'::jsonb,
  top_content jsonb not null default '[]'::jsonb,
  demand_signals jsonb not null default '[]'::jsonb,
  demand_score numeric not null default 0 check (demand_score between 0 and 100),
  summary text,
  fingerprint text,
  created_at timestamptz not null default now(),
  unique(provider,network,period_start,period_end,fingerprint)
);

create table if not exists public.adminos_founder_post_queue (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.adminos_growth_campaigns(id) on delete set null,
  content_plan_id uuid references public.adminos_content_plans(id) on delete set null,
  social_demand_snapshot_id uuid references public.adminos_social_demand_snapshots(id) on delete set null,
  network text not null check (network in ('tiktok','instagram','facebook','youtube','linkedin','threads','x','pinterest','google_business')),
  status text not null default 'awaiting_founder' check (status in ('awaiting_founder','ready_to_post','posted','skipped','rejected')),
  priority numeric not null default 0 check (priority between 0 and 100),
  hook text,
  caption text,
  title text,
  asset_brief text,
  why_now text,
  recommended_posting_window text,
  source_signals jsonb not null default '{}'::jsonb,
  founder_authorized_at timestamptz,
  founder_authorized_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  posted_url text,
  external_post_id text,
  created_by text not null default 'luna_social_demand',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_social_demand_network_created on public.adminos_social_demand_snapshots(network,created_at desc);
create index if not exists idx_founder_post_queue_status on public.adminos_founder_post_queue(status,priority desc,created_at desc);

alter table public.adminos_social_demand_snapshots enable row level security;
alter table public.adminos_founder_post_queue enable row level security;

drop policy if exists adminos_social_demand_snapshots_staff_read on public.adminos_social_demand_snapshots;
create policy adminos_social_demand_snapshots_staff_read on public.adminos_social_demand_snapshots
for select to authenticated using (public.get_user_staff_role(auth.uid()) is not null);
drop policy if exists adminos_social_demand_snapshots_admin_manage on public.adminos_social_demand_snapshots;
create policy adminos_social_demand_snapshots_admin_manage on public.adminos_social_demand_snapshots
for all to authenticated using (public.is_reskonnect_admin(auth.uid())) with check (public.is_reskonnect_admin(auth.uid()));

drop policy if exists adminos_founder_post_queue_staff_read on public.adminos_founder_post_queue;
create policy adminos_founder_post_queue_staff_read on public.adminos_founder_post_queue
for select to authenticated using (public.get_user_staff_role(auth.uid()) is not null);
drop policy if exists adminos_founder_post_queue_admin_manage on public.adminos_founder_post_queue;
create policy adminos_founder_post_queue_admin_manage on public.adminos_founder_post_queue
for all to authenticated using (public.is_reskonnect_admin(auth.uid())) with check (public.is_reskonnect_admin(auth.uid()));

create or replace function public.luna_rg3_touch_updated_at()
returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists trg_founder_post_queue_touch on public.adminos_founder_post_queue;
create trigger trg_founder_post_queue_touch before update on public.adminos_founder_post_queue
for each row execute function public.luna_rg3_touch_updated_at();

-- Explicit publishing policy. Agents can prepare content but may not progress it into
-- autonomous publishing states. Founder authorization only means content is ready for
-- the founder to post manually; it does not call a social publishing API.
insert into public.adminos_agent_config(agent_key,display_name,enabled,authority_level,confidence_threshold,config)
values(
  'luna_social_demand','Luna Social Demand Intelligence',true,'read_only',0.80,
  jsonb_build_object(
    'provider','metricool',
    'analytics_only',true,
    'can_publish',false,
    'can_schedule',false,
    'can_create_metricool_posts',false,
    'posting_mode','founder_manual',
    'connected_brand_id','6910625',
    'networks',jsonb_build_array('instagram','tiktok','facebook','youtube'),
    'objective','Analyse social demand and prepare founder-ready recommendations only'
  )
)
on conflict(agent_key) do update set
  display_name=excluded.display_name,
  enabled=true,
  authority_level='read_only',
  confidence_threshold=excluded.confidence_threshold,
  config=coalesce(public.adminos_agent_config.config,'{}'::jsonb)||excluded.config,
  updated_at=now();

-- Prevent Luna/Metricool automation from silently scheduling or publishing.
create or replace function public.enforce_founder_manual_social_posting()
returns trigger language plpgsql set search_path=public as $$
begin
  if coalesce(new.provider,'')='metricool'
     and new.status in ('queued','scheduled','published')
     and coalesce(new.payload->>'founder_authorized','false') <> 'true' then
    raise exception 'Metricool is analytics-only by default. Founder authorization is required before any posting state.';
  end if;
  return new;
end $$;
revoke all on function public.enforce_founder_manual_social_posting() from public,anon,authenticated;
drop trigger if exists trg_enforce_founder_manual_social_posting on public.adminos_social_posts;
create trigger trg_enforce_founder_manual_social_posting
before insert or update on public.adminos_social_posts
for each row execute function public.enforce_founder_manual_social_posting();

create or replace function public.luna_social_demand_overview()
returns jsonb
language plpgsql security definer set search_path=public as $$
declare allowed boolean; result jsonb;
begin
  select exists(select 1 from public.user_roles ur where ur.user_id=auth.uid() and ur.role::text in ('admin','super_admin','developer','owner','growth_lead','operations_lead','system_operator')) into allowed;
  if auth.uid() is null or not allowed then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'policy',jsonb_build_object('provider','metricool','analytics_only',true,'can_publish',false,'posting_mode','founder_manual'),
    'latest_by_network',coalesce((select jsonb_agg(to_jsonb(x)) from (
      select distinct on(network) id,network,period_start,period_end,demand_score,summary,metrics,top_content,demand_signals,created_at
      from public.adminos_social_demand_snapshots order by network,created_at desc
    ) x),'[]'::jsonb),
    'queue',coalesce((select jsonb_agg(to_jsonb(q) order by q.priority desc,q.created_at desc) from (
      select id,network,status,priority,hook,caption,title,asset_brief,why_now,recommended_posting_window,created_at,posted_at,posted_url
      from public.adminos_founder_post_queue
      where status in ('awaiting_founder','ready_to_post')
      limit 50
    ) q),'[]'::jsonb),
    'awaiting_founder',(select count(*) from public.adminos_founder_post_queue where status='awaiting_founder'),
    'ready_to_post',(select count(*) from public.adminos_founder_post_queue where status='ready_to_post'),
    'posted_30d',(select count(*) from public.adminos_founder_post_queue where status='posted' and posted_at>=now()-interval '30 days')
  ) into result;
  return result;
end $$;
revoke all on function public.luna_social_demand_overview() from public,anon;
grant execute on function public.luna_social_demand_overview() to authenticated;
