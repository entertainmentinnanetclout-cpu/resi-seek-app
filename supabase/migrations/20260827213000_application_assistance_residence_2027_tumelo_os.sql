-- ResKonnect: flexible applicant identity, residence 2027 workspace, creator assistance and Tumelo Intelligence OS

alter table public.profiles
  add column if not exists identity_number text,
  add column if not exists applicant_stage text;

alter table public.profiles drop constraint if exists profiles_applicant_stage_check;
alter table public.profiles add constraint profiles_applicant_stage_check
  check (applicant_stage is null or applicant_stage in ('university_student','tvet_student','matriculant','private_applicant','other'));

create or replace function public.profile_has_required_contact(_user_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security='off' as $$
  select exists (
    select 1 from public.profiles p
    where p.id=_user_id
      and nullif(btrim(coalesce(p.full_name,'')),'') is not null
      and nullif(btrim(coalesce(p.phone,'')),'') is not null
      and (nullif(btrim(coalesce(p.student_number,'')),'') is not null or nullif(btrim(coalesce(p.identity_number,'')),'') is not null)
      and nullif(btrim(coalesce(p.campus,'')),'') is not null
  )
$$;

create or replace function public.enforce_student_contact_before_action()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
  if new.user_id is not null and not public.profile_has_required_contact(new.user_id) then
    raise exception 'Complete your full name, phone number, campus and either a student number or South African ID before continuing.' using errcode='P0001';
  end if;
  return new;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='public' as $$
declare _email text := lower(coalesce(new.email, ''));
begin
  begin
    insert into public.profiles (id,full_name,email,phone,student_number,identity_number,campus,applicant_stage)
    values (
      new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email,
      nullif(new.raw_user_meta_data->>'phone',''),nullif(new.raw_user_meta_data->>'student_number',''),
      nullif(new.raw_user_meta_data->>'identity_number',''),nullif(new.raw_user_meta_data->>'campus',''),
      nullif(new.raw_user_meta_data->>'applicant_stage','')
    )
    on conflict (id) do update set
      email=excluded.email,
      full_name=coalesce(nullif(public.profiles.full_name,''),excluded.full_name),
      phone=coalesce(nullif(public.profiles.phone,''),excluded.phone),
      student_number=coalesce(nullif(public.profiles.student_number,''),excluded.student_number),
      identity_number=coalesce(nullif(public.profiles.identity_number,''),excluded.identity_number),
      campus=coalesce(nullif(public.profiles.campus,''),excluded.campus),
      applicant_stage=coalesce(public.profiles.applicant_stage,excluded.applicant_stage),
      updated_at=now();
  exception when unique_violation then null; end;

  insert into public.user_roles(user_id,role) values(new.id,'student'::public.app_role)
  on conflict(user_id,role) do nothing;
  if _email in ('43v3r2a11@gmail.com','reskonnect@gmail.com') then
    insert into public.user_roles(user_id,role) values(new.id,'admin'::public.app_role)
    on conflict(user_id,role) do nothing;
  end if;
  return new;
end $$;

alter table public.accommodation_reservations
  add column if not exists applicant_name text,
  add column if not exists residence_notes text;

update public.accommodation_reservations r set applicant_name=p.full_name
from public.profiles p where r.user_id=p.id and nullif(btrim(coalesce(r.applicant_name,'')),'') is null;

create or replace function public.set_reservation_applicant_name()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
  if new.user_id is not null and nullif(btrim(coalesce(new.applicant_name,'')),'') is null then
    select p.full_name into new.applicant_name from public.profiles p where p.id=new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_set_reservation_applicant_name on public.accommodation_reservations;
create trigger trg_set_reservation_applicant_name before insert or update of user_id on public.accommodation_reservations
for each row execute function public.set_reservation_applicant_name();
revoke execute on function public.set_reservation_applicant_name() from public,anon,authenticated;

drop policy if exists "residence portal view own reservations" on public.accommodation_reservations;
create policy "residence portal view own reservations" on public.accommodation_reservations for select to authenticated
using (public.is_authorized_residence_user(residence_id));

create or replace view public.residence_portal_reservations_safe with (security_invoker=true) as
select id,residence_id,academic_year,applicant_name,funding_type,room_preference,status,residence_notes,last_contacted_at,created_at,updated_at
from public.accommodation_reservations;
grant select on public.residence_portal_reservations_safe to authenticated;

create or replace function public.residence_portal_update_reservation(p_reservation_id uuid,p_status text default null,p_note text default null)
returns public.accommodation_reservations language plpgsql security definer set search_path='public' as $$
declare v_row public.accommodation_reservations;
begin
  select * into v_row from public.accommodation_reservations where id=p_reservation_id;
  if not found then raise exception 'Reservation not found'; end if;
  if not (public.is_authorized_residence_user(v_row.residence_id) or public.can_manage_accommodation_reservations()) then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_status is not null and p_status not in ('reserved','contacted','provisional_hold','confirmed','cancelled') then raise exception 'Invalid reservation status'; end if;
  update public.accommodation_reservations set
    status=coalesce(p_status,status),residence_notes=coalesce(p_note,residence_notes),
    last_contacted_at=case when p_status='contacted' then now() else last_contacted_at end,updated_at=now()
  where id=p_reservation_id returning * into v_row;
  return v_row;
end $$;
revoke all on function public.residence_portal_update_reservation(uuid,text,text) from public,anon;
grant execute on function public.residence_portal_update_reservation(uuid,text,text) to authenticated;

create table if not exists public.creator_assistance_cases (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_partners(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  applicant_name text not null,email text,phone text,student_number text,identity_number text,
  applicant_stage text not null default 'other',campus text,course text,year_of_study text,
  institution_type text,target_institutions text[] not null default '{}',qualification_interests text,funding_type text,
  intake_year integer not null default 2027,status text not null default 'requested',consent_status text not null default 'granted',
  student_notes text,creator_notes text,application_reference text,submitted_at timestamptz,last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  constraint creator_assistance_stage_check check(applicant_stage in ('university_student','tvet_student','matriculant','private_applicant','other')),
  constraint creator_assistance_status_check check(status in ('requested','documents_pending','ready_to_apply','in_progress','submitted','awaiting_response','completed','closed')),
  constraint creator_assistance_consent_check check(consent_status in ('granted','revoked')),
  constraint creator_assistance_identifier_check check(nullif(btrim(coalesce(student_number,'')),'') is not null or nullif(btrim(coalesce(identity_number,'')),'') is not null),
  unique(creator_id,student_user_id,intake_year)
);
create index if not exists creator_assistance_creator_status_idx on public.creator_assistance_cases(creator_id,status,updated_at desc);
create index if not exists creator_assistance_student_idx on public.creator_assistance_cases(student_user_id,updated_at desc);
alter table public.creator_assistance_cases enable row level security;

drop policy if exists "student creates own creator assistance case" on public.creator_assistance_cases;
create policy "student creates own creator assistance case" on public.creator_assistance_cases for insert to authenticated with check(
  student_user_id=auth.uid() and consent_status='granted' and exists(select 1 from public.creator_partners cp where cp.id=creator_id and cp.status='active'));
drop policy if exists "student views own creator assistance case" on public.creator_assistance_cases;
create policy "student views own creator assistance case" on public.creator_assistance_cases for select to authenticated using(student_user_id=auth.uid());
drop policy if exists "student updates own creator assistance case" on public.creator_assistance_cases;
create policy "student updates own creator assistance case" on public.creator_assistance_cases for update to authenticated using(student_user_id=auth.uid()) with check(student_user_id=auth.uid());
drop policy if exists "creator manages assigned assistance cases" on public.creator_assistance_cases;
create policy "creator manages assigned assistance cases" on public.creator_assistance_cases for all to authenticated using(
  consent_status='granted' and exists(select 1 from public.creator_partners cp where cp.id=creator_id and cp.user_id=auth.uid() and cp.status='active'))
with check(consent_status='granted' and exists(select 1 from public.creator_partners cp where cp.id=creator_id and cp.user_id=auth.uid() and cp.status='active'));
drop policy if exists "growth staff manage creator assistance cases" on public.creator_assistance_cases;
create policy "growth staff manage creator assistance cases" on public.creator_assistance_cases for all to authenticated
using(public.can_manage_growth()) with check(public.can_manage_growth());

create table if not exists public.application_assistance_documents (
  id uuid primary key default gen_random_uuid(),case_id uuid not null references public.creator_assistance_cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,document_type text not null,file_name text not null,file_path text not null unique,
  file_size bigint,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists application_assistance_documents_case_idx on public.application_assistance_documents(case_id,created_at desc);
alter table public.application_assistance_documents enable row level security;
drop policy if exists "student manages own assistance documents" on public.application_assistance_documents;
create policy "student manages own assistance documents" on public.application_assistance_documents for all to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.creator_assistance_cases c where c.id=case_id and c.student_user_id=auth.uid() and c.consent_status='granted'));
drop policy if exists "creator reads assigned assistance documents" on public.application_assistance_documents;
create policy "creator reads assigned assistance documents" on public.application_assistance_documents for select to authenticated using(
  exists(select 1 from public.creator_assistance_cases c join public.creator_partners cp on cp.id=c.creator_id
    where c.id=case_id and c.student_user_id=user_id and c.consent_status='granted' and c.status<>'closed' and cp.user_id=auth.uid() and cp.status='active'));
drop policy if exists "growth staff manage assistance documents" on public.application_assistance_documents;
create policy "growth staff manage assistance documents" on public.application_assistance_documents for all to authenticated
using(public.can_manage_growth()) with check(public.can_manage_growth());

update storage.buckets set public=false where id='application-documents';
drop policy if exists "creator read consented application assistance files" on storage.objects;
create policy "creator read consented application assistance files" on storage.objects for select to authenticated using(
  bucket_id='application-documents' and exists(
    select 1 from public.creator_assistance_cases c join public.creator_partners cp on cp.id=c.creator_id
    where c.student_user_id::text=(storage.foldername(name))[1] and c.id::text=(storage.foldername(name))[2]
      and c.consent_status='granted' and c.status<>'closed' and cp.user_id=auth.uid() and cp.status='active'));

create or replace function public.creator_assistance_touch() returns trigger language plpgsql set search_path='public' as $$
begin
  new.updated_at=now(); new.last_activity_at=now();
  if new.status='submitted' and old.status is distinct from 'submitted' then new.submitted_at=coalesce(new.submitted_at,now()); end if;
  return new;
end $$;
drop trigger if exists trg_creator_assistance_touch on public.creator_assistance_cases;
create trigger trg_creator_assistance_touch before update on public.creator_assistance_cases for each row execute function public.creator_assistance_touch();
revoke execute on function public.creator_assistance_touch() from public,anon,authenticated;

create or replace function public.track_creator_assistance_event() returns trigger language plpgsql security definer set search_path='public' as $$
begin
  if tg_op='INSERT' then
    insert into public.creator_referral_events(creator_id,user_id,event_type,entity_type,entity_id,metadata)
    values(new.creator_id,new.student_user_id,'application_assistance_requested','creator_assistance_case',new.id::text,jsonb_build_object('intake_year',new.intake_year,'applicant_stage',new.applicant_stage));
  elsif new.status is distinct from old.status and new.status in ('submitted','completed') then
    insert into public.creator_referral_events(creator_id,user_id,event_type,entity_type,entity_id,metadata)
    values(new.creator_id,new.student_user_id,case when new.status='submitted' then 'application_assisted' else 'application_assistance_completed' end,'creator_assistance_case',new.id::text,jsonb_build_object('status',new.status,'intake_year',new.intake_year));
  end if;
  return new;
end $$;
drop trigger if exists trg_track_creator_assistance_event on public.creator_assistance_cases;
create trigger trg_track_creator_assistance_event after insert or update of status on public.creator_assistance_cases for each row execute function public.track_creator_assistance_event();
revoke execute on function public.track_creator_assistance_event() from public,anon,authenticated;

create table if not exists public.partnership_memberships (
  id uuid primary key default gen_random_uuid(),partnership_id uuid not null references public.partnerships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,role text not null default 'viewer',is_active boolean not null default true,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  constraint partnership_membership_role_check check(role in ('owner','strategist','viewer')),unique(partnership_id,user_id)
);
alter table public.partnership_memberships enable row level security;
drop policy if exists "members view own partnership membership" on public.partnership_memberships;
create policy "members view own partnership membership" on public.partnership_memberships for select to authenticated using(user_id=auth.uid() or public.can_manage_growth());
drop policy if exists "growth manages partnership membership" on public.partnership_memberships;
create policy "growth manages partnership membership" on public.partnership_memberships for all to authenticated using(public.can_manage_growth()) with check(public.can_manage_growth());

create or replace function public.can_access_partnership(p_slug text) returns boolean language sql stable security definer set search_path='' set row_security='off' as $$
  select public.can_manage_growth() or exists(
    select 1 from public.partnership_memberships pm join public.partnerships p on p.id=pm.partnership_id
    where p.slug=p_slug and pm.user_id=auth.uid() and pm.is_active)
$$;
revoke all on function public.can_access_partnership(text) from public,anon;
grant execute on function public.can_access_partnership(text) to authenticated;

create or replace function public.admin_assign_partnership_member_by_email(p_partner_slug text,p_email text,p_role text default 'owner')
returns uuid language plpgsql security definer set search_path='public' as $$
declare v_partner uuid; v_user uuid; v_id uuid;
begin
  if not public.can_manage_growth() then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_role not in ('owner','strategist','viewer') then raise exception 'Invalid role'; end if;
  select id into v_partner from public.partnerships where slug=p_partner_slug;
  if v_partner is null then raise exception 'Partnership not found'; end if;
  select id into v_user from public.profiles where lower(email)=lower(p_email) order by updated_at desc nulls last limit 1;
  if v_user is null then raise exception 'User must create/sign in to a ResKonnect account first'; end if;
  insert into public.partnership_memberships(partnership_id,user_id,role,is_active) values(v_partner,v_user,p_role,true)
  on conflict(partnership_id,user_id) do update set role=excluded.role,is_active=true,updated_at=now() returning id into v_id;
  return v_id;
end $$;
revoke all on function public.admin_assign_partnership_member_by_email(text,text,text) from public,anon;
grant execute on function public.admin_assign_partnership_member_by_email(text,text,text) to authenticated;

create or replace function public.tumelo_intelligence_summary(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_partner public.partnerships; v_since timestamptz; v_result jsonb;
begin
  if not public.can_access_partnership('tumelo-career-education') then raise exception 'Tumelo Intelligence OS access required' using errcode='42501'; end if;
  select * into v_partner from public.partnerships where slug='tumelo-career-education' limit 1;
  if v_partner.id is null then raise exception 'Tumelo partnership is not configured'; end if;
  v_since:=now()-make_interval(days=>greatest(1,least(coalesce(p_days,30),365)));
  select jsonb_build_object(
    'partner',jsonb_build_object('id',v_partner.id,'name',v_partner.name,'slug',v_partner.slug,'status',v_partner.status,'goal',v_partner.conversion_goal,'public_path',v_partner.public_path),
    'range_days',greatest(1,least(coalesce(p_days,30),365)),
    'page_views',(select count(*) from public.growth_events g where g.partner_slug=v_partner.slug and g.occurred_at>=v_since and g.event_type='page_view'),
    'tracked_events',(select count(*) from public.growth_events g where g.partner_slug=v_partner.slug and g.occurred_at>=v_since),
    'attributed_users',(select count(distinct a.user_id) from public.partnership_attributions a where a.partner_id=v_partner.id and a.user_id is not null and a.last_attributed_at>=v_since),
    'attributed_sessions',(select count(distinct a.session_id) from public.partnership_attributions a where a.partner_id=v_partner.id and a.last_attributed_at>=v_since),
    'conversions',coalesce((select jsonb_object_agg(x.event_type,x.cnt) from (select event_type,count(*) cnt from public.partnership_conversion_events where partner_id=v_partner.id and created_at>=v_since group by event_type)x),'{}'::jsonb),
    'published_content',(select count(*) from public.partner_content where lower(partner_name)=lower(v_partner.name) and is_published=true),
    'published_videos',(select count(*) from public.partner_videos where provider_slug='tumelo' and is_published=true),
    'recent_activity',coalesce((select jsonb_agg(to_jsonb(q) order by q.at desc) from (select event_type as type,entity_type,entity_id,created_at as at from public.partnership_conversion_events where partner_id=v_partner.id order by created_at desc limit 15)q),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.tumelo_intelligence_summary(integer) from public,anon;
grant execute on function public.tumelo_intelligence_summary(integer) to authenticated;
