-- Admin + communications layer for 2027 accommodation reservations.

create or replace function public.can_manage_accommodation_reservations()
returns boolean language sql stable security definer set search_path='' set row_security='off' as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id=auth.uid() and ur.role::text in ('admin','operations_lead','support_agent','growth_lead')
  )
$$;

create or replace function public.can_manage_site_content()
returns boolean language sql stable security definer set search_path='' set row_security='off' as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id=auth.uid() and ur.role::text in ('admin','growth_lead','system_operator')
  )
$$;

alter table public.accommodation_reservations add column if not exists admin_notes text;
alter table public.accommodation_reservations add column if not exists last_contacted_at timestamptz;

drop policy if exists "reservation users view own" on public.accommodation_reservations;
create policy "reservation users view own" on public.accommodation_reservations for select to authenticated
using (user_id=auth.uid() or public.can_manage_accommodation_reservations());
drop policy if exists "reservation users create own" on public.accommodation_reservations;
create policy "reservation users create own" on public.accommodation_reservations for insert to authenticated
with check (user_id=auth.uid());
drop policy if exists "reservation users update own" on public.accommodation_reservations;
create policy "reservation users update own" on public.accommodation_reservations for update to authenticated
using (user_id=auth.uid() or public.can_manage_accommodation_reservations())
with check (user_id=auth.uid() or public.can_manage_accommodation_reservations());
drop policy if exists "reservation staff delete" on public.accommodation_reservations;
create policy "reservation staff delete" on public.accommodation_reservations for delete to authenticated
using (public.can_manage_accommodation_reservations());

create or replace function public.touch_accommodation_reservation() returns trigger
language plpgsql security definer set search_path='public' as $$ begin new.updated_at:=now(); return new; end $$;
drop trigger if exists trg_touch_accommodation_reservation on public.accommodation_reservations;
create trigger trg_touch_accommodation_reservation before update on public.accommodation_reservations
for each row execute function public.touch_accommodation_reservation();

create or replace function public.notify_accommodation_reservation_created() returns trigger
language plpgsql security definer set search_path='public' as $$
declare residence_name text; student_name text;
begin
  select name into residence_name from public.residences where id=new.residence_id;
  select coalesce(full_name,email,'Student') into student_name from public.profiles where id=new.user_id;
  insert into public.notifications(user_id,title,message,type,metadata,is_read,created_at)
  values(new.user_id,new.academic_year::text||' accommodation reservation received',
    'Your reservation interest for '||coalesce(residence_name,'this residence')||' has been recorded. ResKonnect will keep you updated on the next step.',
    'accommodation_reservation',jsonb_build_object('reservation_id',new.id,'residence_id',new.residence_id,'academic_year',new.academic_year,'status',new.status),false,now());
  if new.academic_year=2027 then
    insert into public.admin_alerts(title,description,severity,resolved,created_at)
    values('New 2027 accommodation reservation',coalesce(student_name,'A student')||' reserved interest for '||coalesce(residence_name,'a residence')||'. Funding: '||new.funding_type||'.','info',false,now());
    insert into public.system_events(type,actor_user_id,entity,entity_id,metadata,payload,created_at)
    values('NEW_2027_RESERVATION',new.user_id,'accommodation_reservation',new.id::text,
      jsonb_build_object('residence_id',new.residence_id,'residence_name',residence_name,'funding_type',new.funding_type),
      jsonb_build_object('academic_year',new.academic_year,'status',new.status,'source',new.source),now());
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_accommodation_reservation_created on public.accommodation_reservations;
create trigger trg_notify_accommodation_reservation_created after insert on public.accommodation_reservations
for each row execute function public.notify_accommodation_reservation_created();

create or replace function public.notify_accommodation_reservation_status() returns trigger
language plpgsql security definer set search_path='public' as $$
declare residence_name text;
begin
  if old.status is distinct from new.status then
    select name into residence_name from public.residences where id=new.residence_id;
    insert into public.notifications(user_id,title,message,type,metadata,is_read,created_at)
    values(new.user_id,new.academic_year::text||' reservation update',
      'Your reservation for '||coalesce(residence_name,'your selected residence')||' is now '||replace(new.status,'_',' ')||'.',
      'accommodation_reservation_status',jsonb_build_object('reservation_id',new.id,'status',new.status,'academic_year',new.academic_year),false,now());
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_accommodation_reservation_status on public.accommodation_reservations;
create trigger trg_notify_accommodation_reservation_status after update on public.accommodation_reservations
for each row execute function public.notify_accommodation_reservation_status();

create or replace view public.accommodation_reservations_admin_v with (security_invoker=true) as
select ar.id,ar.user_id,ar.residence_id,ar.academic_year,ar.funding_type,ar.room_preference,ar.status,ar.notes,ar.admin_notes,ar.source,
       ar.last_contacted_at,ar.created_at,ar.updated_at,r.name residence_name,r.address residence_address,r.campus residence_campus,
       p.full_name student_name,p.student_number,p.email student_email,p.phone student_phone
from public.accommodation_reservations ar
left join public.residences r on r.id=ar.residence_id
left join public.profiles p on p.id=ar.user_id;
grant select on public.accommodation_reservations_admin_v to authenticated;

create table if not exists public.site_announcements (
  id uuid primary key default gen_random_uuid(), title text not null, subtitle text, body text not null, badge text,
  cta_label text, cta_url text, image_url text, graphic_variant text not null default 'reskonnect', audience text not null default 'all',
  is_active boolean not null default true, dismissible boolean not null default true, priority integer not null default 100,
  starts_at timestamptz, ends_at timestamptz, created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_site_announcements_active_priority on public.site_announcements(is_active,priority desc,updated_at desc);
alter table public.site_announcements enable row level security;
drop policy if exists "public can read active announcements" on public.site_announcements;
create policy "public can read active announcements" on public.site_announcements for select to anon,authenticated
using ((is_active=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now())) or public.can_manage_site_content());
drop policy if exists "staff manage announcements" on public.site_announcements;
create policy "staff manage announcements" on public.site_announcements for all to authenticated
using (public.can_manage_site_content()) with check (public.can_manage_site_content());

create or replace function public.touch_site_announcement() returns trigger language plpgsql security definer set search_path='public' as $$
begin new.updated_at:=now(); new.updated_by:=coalesce(auth.uid(),new.updated_by); return new; end $$;
drop trigger if exists trg_touch_site_announcement on public.site_announcements;
create trigger trg_touch_site_announcement before update on public.site_announcements for each row execute function public.touch_site_announcement();

insert into public.site_announcements(title,subtitle,body,badge,cta_label,cta_url,graphic_variant,audience,is_active,dismissible,priority,starts_at)
select '2027 accommodation reservations are now open','Pretoria intake reservations have started',
'Reserve your interest for selected 2027 accommodation on ResKonnect. Private and NSFAS-funded pricing can differ, so always check the funding-specific rate shown on each residence.',
'2027 RESERVATIONS OPEN','Explore 2027 accommodation','/find?reserve=2027','reskonnect_2027','all',true,true,1000,now()
where not exists(select 1 from public.site_announcements where lower(title)=lower('2027 accommodation reservations are now open'));

-- Repair the previous reciprocal applications <-> application_referrals policy recursion.
create or replace function public.is_application_owner(_application_id uuid,_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' set row_security='off' as $$
 select exists(select 1 from public.applications a where a.id=_application_id and a.user_id=_user_id)
$$;
drop policy if exists "app_ref visible to owner, agent, admin" on public.application_referrals;
create policy "app_ref visible to owner, agent, admin" on public.application_referrals for select to authenticated
using(referral_agent_user_id=auth.uid() or public.has_role(auth.uid(),'admin'::public.app_role) or public.is_application_owner(application_id,auth.uid()));

-- Public support partner is Tech-Up; legacy SETUP row is removed.
drop policy if exists "staff manage support partners" on public.application_support_partners;
create policy "staff manage support partners" on public.application_support_partners for all to authenticated
using (public.can_manage_site_content()) with check(public.can_manage_site_content());
delete from public.application_support_partners where slug='setup';
delete from public.partner_showcase where lower(coalesce(slug,''))='setup' or lower(coalesce(name,''))='setup';
