-- ResKonnect 360 Studio V2 · Release Gate 3 (Phases 7-8) + Release Gate 4 (Phases 9-10)
-- Marketplace discovery, Premium landlord governance, Gold analytics, Dimpho tour intelligence and server-side scene quotas.

insert into public.virtual_tour_release_registry(release_key,release_name,status,phases,metadata) values
('rg3','360 Studio V2 · Marketplace + Premium Landlords','active',array[7,8],'{"version":"v2","marketplace":true,"premium_landlords":true}'::jsonb),
('rg4','360 Studio V2 · Gold Production Platform','active',array[9,10],'{"version":"v2","analytics":true,"dimpho":true,"mobile_optimized":true}'::jsonb)
on conflict (release_key) do update set release_name=excluded.release_name,status=excluded.status,phases=excluded.phases,metadata=excluded.metadata,updated_at=now();

create table if not exists public.virtual_tour_upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete cascade,
  requested_by uuid not null,
  requested_plan text not null check(requested_plan in ('premium','gold')),
  status text not null default 'pending' check(status in ('pending','approved','declined','cancelled','completed')),
  decided_by uuid,
  decided_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_virtual_tour_upgrade_requests_residence on public.virtual_tour_upgrade_requests(residence_id,status,created_at desc);
create unique index if not exists uq_virtual_tour_upgrade_pending on public.virtual_tour_upgrade_requests(residence_id,requested_plan) where status='pending';
alter table public.virtual_tour_upgrade_requests enable row level security;
grant select,insert,update on public.virtual_tour_upgrade_requests to authenticated;

do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='virtual_tour_upgrade_requests' and policyname='virtual_tour_upgrade_manager_read') then
    create policy virtual_tour_upgrade_manager_read on public.virtual_tour_upgrade_requests for select to authenticated
      using(public.virtual_tour_can_manage_residence(residence_id));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='virtual_tour_upgrade_requests' and policyname='virtual_tour_upgrade_manager_insert') then
    create policy virtual_tour_upgrade_manager_insert on public.virtual_tour_upgrade_requests for insert to authenticated
      with check(requested_by=auth.uid() and public.virtual_tour_can_manage_residence(residence_id));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='virtual_tour_upgrade_requests' and policyname='virtual_tour_upgrade_admin_update') then
    create policy virtual_tour_upgrade_admin_update on public.virtual_tour_upgrade_requests for update to authenticated
      using(public.virtual_tour_is_admin()) with check(public.virtual_tour_is_admin());
  end if;
end $$;

-- Gold analytics: managers may read only analytics belonging to residences they can manage.
create index if not exists idx_virtual_tour_analytics_tour_event_time on public.virtual_tour_analytics(tour_id,event_type,created_at desc);
create index if not exists idx_virtual_tour_analytics_scene_time on public.virtual_tour_analytics(scene_id,created_at desc) where scene_id is not null;
create index if not exists idx_virtual_tour_publications_active on public.virtual_tour_publications(residence_id,status,published_at desc);

do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='virtual_tour_analytics' and policyname='virtual_tour_analytics_manager_read') then
    create policy virtual_tour_analytics_manager_read on public.virtual_tour_analytics for select to authenticated using(
      exists(select 1 from public.virtual_tours t where t.id=virtual_tour_analytics.tour_id and public.virtual_tour_can_manage_residence(t.residence_id))
    );
  end if;
end $$;

-- Server-side entitlement and quota enforcement. Frontend limits are UX only; this is the authoritative boundary.
create or replace function public.virtual_tour_enforce_scene_entitlement()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_residence uuid;
  v_plan text;
  v_entitlements text[];
  v_scene_count integer;
begin
  if auth.role()='service_role' or public.virtual_tour_is_admin() then return new; end if;
  select residence_id into v_residence from public.virtual_tours where id=new.tour_id;
  if v_residence is null or not public.virtual_tour_can_manage_residence(v_residence) then raise exception '360 Studio residence access denied' using errcode='42501'; end if;

  select plan,entitlements into v_plan,v_entitlements
  from public.virtual_tour_entitlements
  where residence_id=v_residence and is_active=true and (expires_at is null or expires_at>now())
  order by updated_at desc limit 1;

  if coalesce(v_plan,'standard') not in ('premium','gold','internal') and not ('virtual_tour.create'=any(coalesce(v_entitlements,'{}'::text[]))) then
    raise exception '360 Studio Premium or Gold entitlement required' using errcode='42501';
  end if;

  select count(*) into v_scene_count from public.virtual_tour_scenes where tour_id=new.tour_id;
  if v_plan='premium' and not ('virtual_tour.unlimited_scenes'=any(coalesce(v_entitlements,'{}'::text[]))) and v_scene_count>=36 then
    raise exception 'Premium includes up to 36 scenes. Upgrade to Gold for extended scene capacity.' using errcode='P0001';
  end if;
  if v_scene_count>=120 then raise exception '360 Studio scene safety limit reached' using errcode='P0001'; end if;
  return new;
end $$;

drop trigger if exists virtual_tour_scene_entitlement_guard on public.virtual_tour_scenes;
create trigger virtual_tour_scene_entitlement_guard before insert on public.virtual_tour_scenes for each row execute function public.virtual_tour_enforce_scene_entitlement();

-- Safe marketplace index. It exposes discovery metadata only, never the immutable publication snapshot/raw assets.
create or replace function public.virtual_tour_marketplace_index(p_residence_ids uuid[] default null)
returns table(residence_id uuid,tour_id uuid,public_token uuid,version_number integer,published_at timestamptz,valid_until timestamptz)
language sql stable security definer set search_path=public as $$
  select distinct on (p.residence_id) p.residence_id,p.tour_id,p.public_token,p.version_number,p.published_at,p.valid_until
  from public.virtual_tour_publications p
  join public.residences r on r.id=p.residence_id
  where p.status='published' and (p.valid_until is null or p.valid_until>now()) and r.is_visible=true
    and (p_residence_ids is null or p.residence_id=any(p_residence_ids))
  order by p.residence_id,p.published_at desc;
$$;
revoke all on function public.virtual_tour_marketplace_index(uuid[]) from public;
grant execute on function public.virtual_tour_marketplace_index(uuid[]) to anon,authenticated;

-- Dimpho RG4 virtual-tour tools. Runtime implementation is source-controlled in dimpho-tool-engine.
insert into public.dimpho_tools(tool_key,name,description,category,operation,risk_level,requires_auth,requires_confirmation,requires_aal2,user_scoped,input_schema,output_schema,enabled,metadata) values
('get_virtual_tour','Residence Virtual Tour','Find the current published ResKonnect Gold 360 tour for a visible residence and return its verified direct URL and scene summary.','accommodation','read','green',false,false,false,false,'{"type":"object","properties":{"residence_id":{"type":"string"},"slug":{"type":"string"}}}','{}',true,'{"source":"supabase","release":"360-rg4"}'),
('get_virtual_tour_scene','Virtual Tour Scene','Read a named or categorized scene from a published ResKonnect Gold 360 tour without exposing raw capture assets.','accommodation','read','green',false,false,false,false,'{"type":"object","properties":{"public_token":{"type":"string"},"scene_name":{"type":"string"},"area_type":{"type":"string"}}}','{}',true,'{"source":"supabase","release":"360-rg4"}')
on conflict(tool_key) do update set name=excluded.name,description=excluded.description,category=excluded.category,operation=excluded.operation,risk_level=excluded.risk_level,requires_auth=excluded.requires_auth,requires_confirmation=excluded.requires_confirmation,requires_aal2=excluded.requires_aal2,user_scoped=excluded.user_scoped,input_schema=excluded.input_schema,output_schema=excluded.output_schema,enabled=excluded.enabled,metadata=excluded.metadata,updated_at=now();

insert into public.dimpho_tool_permissions(tool_id,principal_type,principal_value,can_invoke,max_calls_per_hour,metadata)
select id,'agent','konnect_agent',true,900,'{"release":"360-rg4"}' from public.dimpho_tools where tool_key in ('get_virtual_tour','get_virtual_tour_scene')
on conflict(tool_id,principal_type,principal_value) do update set can_invoke=true,max_calls_per_hour=excluded.max_calls_per_hour,metadata=excluded.metadata;
insert into public.dimpho_tool_permissions(tool_id,principal_type,principal_value,can_invoke,max_calls_per_hour,metadata)
select id,'staff','*',true,900,'{"release":"360-rg4"}' from public.dimpho_tools where tool_key in ('get_virtual_tour','get_virtual_tour_scene')
on conflict(tool_id,principal_type,principal_value) do update set can_invoke=true,max_calls_per_hour=excluded.max_calls_per_hour,metadata=excluded.metadata;

update public.dimpho_intelligence_settings
set release_state=coalesce(release_state,'{}'::jsonb)||'{"virtual_tour_rg3":"active","virtual_tour_rg4":"active"}'::jsonb,updated_at=now()
where id=1;
