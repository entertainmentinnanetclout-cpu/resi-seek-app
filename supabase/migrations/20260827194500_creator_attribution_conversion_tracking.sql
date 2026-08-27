-- Creator Partner conversion attribution.
-- Persists creator ownership across sign-up, accommodation reservations,
-- applications and final landlord CRM placement outcomes.

create table if not exists public.creator_attributions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creator_id uuid not null references public.creator_partners(id) on delete cascade,
  referral_code text,
  session_id text,
  source text not null default 'creator_landing',
  first_attributed_at timestamptz not null default now(),
  last_attributed_at timestamptz not null default now()
);
create index if not exists creator_attributions_creator_idx on public.creator_attributions(creator_id,last_attributed_at desc);

alter table public.creator_attributions enable row level security;
drop policy if exists "users read own creator attribution" on public.creator_attributions;
create policy "users read own creator attribution" on public.creator_attributions for select to authenticated
using (user_id=auth.uid() or public.can_manage_growth());
drop policy if exists "growth staff manage creator attribution" on public.creator_attributions;
create policy "growth staff manage creator attribution" on public.creator_attributions for all to authenticated
using (public.can_manage_growth()) with check (public.can_manage_growth());

create unique index if not exists creator_referral_events_conversion_unique
on public.creator_referral_events(creator_id,event_type,entity_type,entity_id)
where entity_id is not null;

create or replace function public.attribute_creator(
  _creator_id uuid,
  _referral_code text default null,
  _session_id text default null,
  _source text default 'creator_landing'
)
returns boolean
language plpgsql
security definer
set search_path='public'
as $$
declare
  uid uuid := auth.uid();
  active_creator boolean;
begin
  if uid is null then return false; end if;
  select exists(select 1 from public.creator_partners where id=_creator_id and status='active') into active_creator;
  if not active_creator then return false; end if;

  insert into public.creator_attributions(user_id,creator_id,referral_code,session_id,source,first_attributed_at,last_attributed_at)
  values(uid,_creator_id,_referral_code,_session_id,coalesce(nullif(_source,''),'creator_landing'),now(),now())
  on conflict(user_id) do update set
    creator_id=excluded.creator_id,
    referral_code=coalesce(excluded.referral_code,public.creator_attributions.referral_code),
    session_id=coalesce(excluded.session_id,public.creator_attributions.session_id),
    source=excluded.source,
    last_attributed_at=now();

  insert into public.creator_referral_events(creator_id,user_id,session_id,event_type,entity_type,entity_id,metadata)
  values(_creator_id,uid,_session_id,'signup','user',uid::text,jsonb_build_object('source',_source))
  on conflict do nothing;
  return true;
end $$;
grant execute on function public.attribute_creator(uuid,text,text,text) to authenticated;

create or replace function public.track_creator_conversion_from_action()
returns trigger language plpgsql security definer set search_path='public' as $$
declare
  attribution public.creator_attributions%rowtype;
  event_name text;
  entity_name text;
  entity_identifier text;
  metadata_value jsonb;
begin
  select * into attribution from public.creator_attributions where user_id=new.user_id;
  if attribution.user_id is null then return new; end if;

  if tg_table_name='accommodation_reservations' then
    event_name := 'reservation';
    entity_name := 'accommodation_reservation';
    entity_identifier := new.id::text;
    metadata_value := jsonb_build_object('residence_id',new.residence_id,'academic_year',new.academic_year,'funding_type',new.funding_type);
  elsif tg_table_name='applications' then
    event_name := 'application_started';
    entity_name := 'application';
    entity_identifier := new.id::text;
    metadata_value := jsonb_build_object('residence_id',new.residence_id,'funding_type',new.funding_type);
  else
    return new;
  end if;

  insert into public.creator_referral_events(creator_id,user_id,session_id,event_type,entity_type,entity_id,metadata)
  values(attribution.creator_id,new.user_id,attribution.session_id,event_name,entity_name,entity_identifier,metadata_value)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_creator_conversion_reservation on public.accommodation_reservations;
create trigger trg_creator_conversion_reservation after insert on public.accommodation_reservations
for each row execute function public.track_creator_conversion_from_action();

drop trigger if exists trg_creator_conversion_application on public.applications;
create trigger trg_creator_conversion_application after insert on public.applications
for each row execute function public.track_creator_conversion_from_action();

create or replace function public.track_creator_placement_from_lead()
returns trigger language plpgsql security definer set search_path='public' as $$
declare
  attribution public.creator_attributions%rowtype;
begin
  if old.stage is distinct from new.stage and new.stage='placed' and new.user_id is not null then
    select * into attribution from public.creator_attributions where user_id=new.user_id;
    if attribution.user_id is not null then
      insert into public.creator_referral_events(creator_id,user_id,session_id,event_type,entity_type,entity_id,metadata)
      values(attribution.creator_id,new.user_id,attribution.session_id,'placement','residence_lead',new.id::text,
        jsonb_build_object('residence_id',new.residence_id,'source_type',new.source_type,'academic_year',new.academic_year))
      on conflict do nothing;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_creator_placement_from_lead on public.residence_leads;
create trigger trg_creator_placement_from_lead after update of stage on public.residence_leads
for each row execute function public.track_creator_placement_from_lead();
