-- Property Data Quality, privacy-safe Residence Portal, residence-specific recruitment,
-- and unified partnership conversion command centre.

alter table public.residences
  add column if not exists cover_image_url text,
  add column if not exists studio_image_url text,
  add column if not exists brand_badge text,
  add column if not exists brand_headline text,
  add column if not exists brand_subheadline text,
  add column if not exists brand_primary_color text not null default '#000F2F',
  add column if not exists brand_accent_color text not null default '#E09008',
  add column if not exists place_label text,
  add column if not exists city text,
  add column if not exists data_quality_score integer not null default 0,
  add column if not exists data_quality_status text not null default 'needs_data',
  add column if not exists data_quality_missing text[] not null default '{}'::text[],
  add column if not exists last_quality_check_at timestamptz,
  add column if not exists recruiter_opt_in boolean not null default false,
  add column if not exists recruiter_note text,
  add column if not exists public_brand_card_enabled boolean not null default true;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='residences_data_quality_score_check') then
    alter table public.residences add constraint residences_data_quality_score_check check (data_quality_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='residences_data_quality_status_check') then
    alter table public.residences add constraint residences_data_quality_status_check check (data_quality_status in ('needs_data','ready','strong','excellent'));
  end if;
end $$;

alter table public.residence_room_types
  add column if not exists landlord_confirmed_at timestamptz,
  add column if not exists landlord_confirmed_by uuid references auth.users(id) on delete set null;

create table if not exists public.residence_profile_change_log (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'residence',
  changed_fields text[] not null default '{}'::text[],
  patch jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists residence_profile_change_log_residence_idx on public.residence_profile_change_log(residence_id,created_at desc);
alter table public.residence_profile_change_log enable row level security;
drop policy if exists "growth staff read residence profile change log" on public.residence_profile_change_log;
create policy "growth staff read residence profile change log" on public.residence_profile_change_log for select to authenticated using (public.can_manage_growth());
drop policy if exists "residence read own profile change log" on public.residence_profile_change_log;
create policy "residence read own profile change log" on public.residence_profile_change_log for select to authenticated using (public.is_authorized_residence_user(residence_id));

create or replace function public.refresh_residence_data_quality(p_residence_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security='off'
as $$
declare
  r public.residences%rowtype;
  v_score integer := 0;
  v_missing text[] := '{}'::text[];
  v_room_count integer := 0;
  v_priced_room_count integer := 0;
  v_gallery_count integer := 0;
  v_status text;
begin
  select * into r from public.residences where id=p_residence_id;
  if not found then return jsonb_build_object('score',0,'status','missing','missing',jsonb_build_array('residence')); end if;

  select count(*), count(*) filter(where coalesce(private_price,0)>0 or coalesce(nsfas_price,0)>0 or coalesce(promo_price,0)>0)
    into v_room_count,v_priced_room_count
  from public.residence_room_types where residence_id=p_residence_id and is_active=true;
  v_gallery_count := coalesce(array_length(r.images,1),0);

  if length(trim(coalesce(r.name,'')))>=3 then v_score:=v_score+5; else v_missing:=array_append(v_missing,'name'); end if;
  if length(trim(coalesce(r.address,'')))>=8 then v_score:=v_score+10; else v_missing:=array_append(v_missing,'address'); end if;
  if length(trim(coalesce(r.place_label,r.city,'')))>=2 then v_score:=v_score+5; else v_missing:=array_append(v_missing,'place'); end if;
  if length(trim(coalesce(r.campus,'')))>=2 then v_score:=v_score+5; else v_missing:=array_append(v_missing,'campus'); end if;
  if length(trim(coalesce(r.province,'')))>=2 then v_score:=v_score+5; else v_missing:=array_append(v_missing,'province'); end if;
  if length(trim(coalesce(r.description,'')))>=120 then v_score:=v_score+10; else v_missing:=array_append(v_missing,'description_120_chars'); end if;
  if coalesce(r.studio_image_url,r.cover_image_url,r.image_url) is not null then v_score:=v_score+15; else v_missing:=array_append(v_missing,'cover_or_studio_image'); end if;
  if v_gallery_count>=3 then v_score:=v_score+5; else v_missing:=array_append(v_missing,'gallery_3_images'); end if;
  if (jsonb_typeof(coalesce(r.amenities,'[]'::jsonb))='array' and jsonb_array_length(coalesce(r.amenities,'[]'::jsonb))>0) then v_score:=v_score+5; else v_missing:=array_append(v_missing,'amenities'); end if;
  if coalesce(r.capacity,0)>0 then v_score:=v_score+5; else v_missing:=array_append(v_missing,'capacity'); end if;
  if r.available_spots is not null then v_score:=v_score+5; else v_missing:=array_append(v_missing,'available_spots'); end if;
  if v_room_count>0 then v_score:=v_score+10; else v_missing:=array_append(v_missing,'room_types'); end if;
  if v_priced_room_count>0 or coalesce(r.private_price,r.nsfas_price,r.price,0)>0 then v_score:=v_score+10; else v_missing:=array_append(v_missing,'pricing'); end if;
  if r.latitude is not null and r.longitude is not null then v_score:=v_score+5; else v_missing:=array_append(v_missing,'map_coordinates'); end if;

  v_status := case when v_score>=85 then 'excellent' when v_score>=70 then 'strong' when v_score>=50 then 'ready' else 'needs_data' end;
  update public.residences set data_quality_score=v_score,data_quality_status=v_status,data_quality_missing=v_missing,last_quality_check_at=now() where id=p_residence_id;
  return jsonb_build_object('score',v_score,'status',v_status,'missing',to_jsonb(v_missing),'roomTypes',v_room_count,'pricedRoomTypes',v_priced_room_count);
end $$;
revoke all on function public.refresh_residence_data_quality(uuid) from public,anon,authenticated;
grant execute on function public.refresh_residence_data_quality(uuid) to service_role;

create or replace function public.residence_quality_trigger()
returns trigger language plpgsql security definer set search_path='' set row_security='off' as $$
begin
  perform public.refresh_residence_data_quality(coalesce(new.id,old.id));
  return coalesce(new,old);
end $$;

create or replace function public.residence_room_quality_trigger()
returns trigger language plpgsql security definer set search_path='' set row_security='off' as $$
begin
  perform public.refresh_residence_data_quality(coalesce(new.residence_id,old.residence_id));
  if tg_op='UPDATE' and old.residence_id is distinct from new.residence_id then perform public.refresh_residence_data_quality(old.residence_id); end if;
  return coalesce(new,old);
end $$;

drop trigger if exists trg_residence_quality_insert on public.residences;
create trigger trg_residence_quality_insert after insert on public.residences for each row execute function public.residence_quality_trigger();
drop trigger if exists trg_residence_quality_update on public.residences;
create trigger trg_residence_quality_update after update of name,address,place_label,city,campus,province,description,cover_image_url,studio_image_url,image_url,images,amenities,capacity,available_spots,private_price,nsfas_price,price,latitude,longitude on public.residences for each row execute function public.residence_quality_trigger();
drop trigger if exists trg_residence_room_quality on public.residence_room_types;
create trigger trg_residence_room_quality after insert or update or delete on public.residence_room_types for each row execute function public.residence_room_quality_trigger();

create or replace function public.residence_room_pricing_guard()
returns trigger
language plpgsql
security definer
set search_path=''
set row_security='off'
as $$
declare
  v_price_changed boolean;
begin
  v_price_changed := new.private_price is distinct from old.private_price
    or new.nsfas_price is distinct from old.nsfas_price
    or new.promo_price is distinct from old.promo_price
    or new.deposit is distinct from old.deposit
    or new.admin_fee is distinct from old.admin_fee
    or new.reservation_fee is distinct from old.reservation_fee;

  if public.is_authorized_residence_user(old.residence_id) and not public.can_manage_growth() then
    if new.price_verified_at is distinct from old.price_verified_at or new.price_verified_by is distinct from old.price_verified_by then
      raise exception 'Residence portal users cannot set verified pricing';
    end if;
    if v_price_changed then
      new.price_verified_at := null;
      new.price_verified_by := null;
      new.landlord_confirmed_at := now();
      new.landlord_confirmed_by := auth.uid();
    end if;
  elsif v_price_changed then
    if new.price_verified_at is not distinct from old.price_verified_at then new.price_verified_at:=null; new.price_verified_by:=null; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_residence_room_pricing_guard on public.residence_room_types;
create trigger trg_residence_room_pricing_guard before update on public.residence_room_types for each row execute function public.residence_room_pricing_guard();

-- Safe Residence Portal application view: no applicant email or phone.
drop view if exists public.residence_portal_applications_safe;
create view public.residence_portal_applications_safe with (security_barrier=true) as
select a.id,a.user_id,a.residence_id,a.status,a.funding_type,a.created_at,a.updated_at,a.notes,a.application_date,a.move_in_date,a.moved_in,a.institution_type,
       p.full_name as applicant_name,p.student_number,p.campus,p.course
from public.applications a
left join public.profiles p on p.id=a.user_id
where public.is_authorized_residence_user(a.residence_id) or public.can_manage_growth();
revoke all on public.residence_portal_applications_safe from public,anon;
grant select on public.residence_portal_applications_safe to authenticated;

drop policy if exists "Residence users can view applicant profiles" on public.profiles;

-- Safe roommate directory. Public callers never need base profile contact columns.
drop view if exists public.roommate_profiles_public_v;
create view public.roommate_profiles_public_v with (security_barrier=true) as
select id,full_name,campus,course,year_of_study,profile_picture_url,lifestyle_preferences,looking_for_roommate,updated_at
from public.profiles where looking_for_roommate=true;
grant select on public.roommate_profiles_public_v to anon,authenticated;
drop policy if exists "Public can view roommate seekers" on public.profiles;
drop policy if exists "View roommate seekers" on public.profiles;

-- Safe Residence Portal CRM view: no phone/email.
drop view if exists public.residence_portal_leads_safe;
create view public.residence_portal_leads_safe with (security_barrier=true) as
select id,residence_id,user_id,source_type,source_id,stage,funding_type,room_preference,academic_year,contact_name,admin_notes,last_contacted_at,next_follow_up_at,created_at,updated_at
from public.residence_leads
where public.is_authorized_residence_user(residence_id) or public.can_manage_growth();
revoke all on public.residence_portal_leads_safe from public,anon;
grant select on public.residence_portal_leads_safe to authenticated;

drop policy if exists "residence staff manage leads" on public.residence_leads;
drop policy if exists "residence staff read leads" on public.residence_leads;
drop policy if exists "growth staff manage leads" on public.residence_leads;
create policy "growth staff manage leads" on public.residence_leads for all to authenticated using (public.can_manage_growth()) with check (public.can_manage_growth());

create or replace function public.residence_portal_update_lead(p_lead_id uuid,p_patch jsonb)
returns public.residence_portal_leads_safe
language plpgsql
security definer
set search_path=''
set row_security='off'
as $$
declare
  v_lead public.residence_leads%rowtype;
  v_allowed text[] := array['stage','admin_notes','next_follow_up_at'];
  v_key text;
  v_result public.residence_portal_leads_safe%rowtype;
begin
  select * into v_lead from public.residence_leads where id=p_lead_id;
  if not found or not public.is_authorized_residence_user(v_lead.residence_id) then raise exception 'Not authorized'; end if;
  for v_key in select jsonb_object_keys(coalesce(p_patch,'{}'::jsonb)) loop
    if not (v_key=any(v_allowed)) then raise exception 'Field % cannot be changed from the residence portal',v_key; end if;
  end loop;
  update public.residence_leads set
    stage=case when p_patch ? 'stage' then nullif(p_patch->>'stage','') else stage end,
    admin_notes=case when p_patch ? 'admin_notes' then nullif(p_patch->>'admin_notes','') else admin_notes end,
    next_follow_up_at=case when p_patch ? 'next_follow_up_at' then nullif(p_patch->>'next_follow_up_at','')::timestamptz else next_follow_up_at end,
    last_contacted_at=case when (p_patch->>'stage')='contacted' then now() else last_contacted_at end,
    updated_at=now()
  where id=p_lead_id;
  select * into v_result from public.residence_portal_leads_safe where id=p_lead_id;
  return v_result;
end $$;
revoke all on function public.residence_portal_update_lead(uuid,jsonb) from public,anon;
grant execute on function public.residence_portal_update_lead(uuid,jsonb) to authenticated;

create or replace function public.residence_portal_update_profile(p_residence_id uuid,p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security='off'
as $$
declare
  v_allowed text[] := array['name','address','place_label','city','campus','province','description','cover_image_url','studio_image_url','image_url','images','amenities','capacity','available_spots','room_type','room_types','price','private_price','nsfas_price','has_wifi','has_parking','is_furnished','utilities_included','reservations_2027_open','reservations_2027_note','brand_badge','brand_headline','brand_subheadline','brand_primary_color','brand_accent_color','accepts_nsfas','accepts_private','accepts_tvet','accepts_university','recruiter_opt_in','recruiter_note','public_brand_card_enabled'];
  v_key text;
  v_changed text[] := '{}'::text[];
  v_before public.residences%rowtype;
  v_quality jsonb;
begin
  if not public.is_authorized_residence_user(p_residence_id) then raise exception 'Not authorized'; end if;
  select * into v_before from public.residences where id=p_residence_id;
  if not found then raise exception 'Residence not found'; end if;
  for v_key in select jsonb_object_keys(coalesce(p_patch,'{}'::jsonb)) loop
    if not (v_key=any(v_allowed)) then raise exception 'Field % cannot be changed from the residence portal',v_key; end if;
    v_changed:=array_append(v_changed,v_key);
  end loop;
  if p_patch ? 'brand_primary_color' and coalesce(p_patch->>'brand_primary_color','') !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid primary colour'; end if;
  if p_patch ? 'brand_accent_color' and coalesce(p_patch->>'brand_accent_color','') !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid accent colour'; end if;

  update public.residences set
    name=case when p_patch ? 'name' then coalesce(nullif(trim(p_patch->>'name'),''),name) else name end,
    address=case when p_patch ? 'address' then nullif(trim(p_patch->>'address'),'') else address end,
    place_label=case when p_patch ? 'place_label' then nullif(trim(p_patch->>'place_label'),'') else place_label end,
    city=case when p_patch ? 'city' then nullif(trim(p_patch->>'city'),'') else city end,
    campus=case when p_patch ? 'campus' then nullif(trim(p_patch->>'campus'),'') else campus end,
    province=case when p_patch ? 'province' then nullif(trim(p_patch->>'province'),'') else province end,
    description=case when p_patch ? 'description' then nullif(p_patch->>'description','') else description end,
    cover_image_url=case when p_patch ? 'cover_image_url' then nullif(p_patch->>'cover_image_url','') else cover_image_url end,
    studio_image_url=case when p_patch ? 'studio_image_url' then nullif(p_patch->>'studio_image_url','') else studio_image_url end,
    image_url=case when p_patch ? 'image_url' then nullif(p_patch->>'image_url','') else image_url end,
    images=case when p_patch ? 'images' then array(select jsonb_array_elements_text(coalesce(p_patch->'images','[]'::jsonb))) else images end,
    amenities=case when p_patch ? 'amenities' then coalesce(p_patch->'amenities','[]'::jsonb) else amenities end,
    capacity=case when p_patch ? 'capacity' then nullif(p_patch->>'capacity','')::integer else capacity end,
    available_spots=case when p_patch ? 'available_spots' then nullif(p_patch->>'available_spots','')::integer else available_spots end,
    room_type=case when p_patch ? 'room_type' then nullif(p_patch->>'room_type','') else room_type end,
    room_types=case when p_patch ? 'room_types' then array(select jsonb_array_elements_text(coalesce(p_patch->'room_types','[]'::jsonb))) else room_types end,
    price=case when p_patch ? 'price' then nullif(p_patch->>'price','')::numeric else price end,
    private_price=case when p_patch ? 'private_price' then nullif(p_patch->>'private_price','')::numeric else private_price end,
    nsfas_price=case when p_patch ? 'nsfas_price' then nullif(p_patch->>'nsfas_price','')::numeric else nsfas_price end,
    has_wifi=case when p_patch ? 'has_wifi' then (p_patch->>'has_wifi')::boolean else has_wifi end,
    has_parking=case when p_patch ? 'has_parking' then (p_patch->>'has_parking')::boolean else has_parking end,
    is_furnished=case when p_patch ? 'is_furnished' then (p_patch->>'is_furnished')::boolean else is_furnished end,
    utilities_included=case when p_patch ? 'utilities_included' then (p_patch->>'utilities_included')::boolean else utilities_included end,
    reservations_2027_open=case when p_patch ? 'reservations_2027_open' then (p_patch->>'reservations_2027_open')::boolean else reservations_2027_open end,
    reservations_2027_note=case when p_patch ? 'reservations_2027_note' then nullif(p_patch->>'reservations_2027_note','') else reservations_2027_note end,
    brand_badge=case when p_patch ? 'brand_badge' then nullif(p_patch->>'brand_badge','') else brand_badge end,
    brand_headline=case when p_patch ? 'brand_headline' then nullif(p_patch->>'brand_headline','') else brand_headline end,
    brand_subheadline=case when p_patch ? 'brand_subheadline' then nullif(p_patch->>'brand_subheadline','') else brand_subheadline end,
    brand_primary_color=case when p_patch ? 'brand_primary_color' then p_patch->>'brand_primary_color' else brand_primary_color end,
    brand_accent_color=case when p_patch ? 'brand_accent_color' then p_patch->>'brand_accent_color' else brand_accent_color end,
    accepts_nsfas=case when p_patch ? 'accepts_nsfas' then (p_patch->>'accepts_nsfas')::boolean else accepts_nsfas end,
    accepts_private=case when p_patch ? 'accepts_private' then (p_patch->>'accepts_private')::boolean else accepts_private end,
    accepts_tvet=case when p_patch ? 'accepts_tvet' then (p_patch->>'accepts_tvet')::boolean else accepts_tvet end,
    accepts_university=case when p_patch ? 'accepts_university' then (p_patch->>'accepts_university')::boolean else accepts_university end,
    recruiter_opt_in=case when p_patch ? 'recruiter_opt_in' then (p_patch->>'recruiter_opt_in')::boolean else recruiter_opt_in end,
    recruiter_note=case when p_patch ? 'recruiter_note' then nullif(p_patch->>'recruiter_note','') else recruiter_note end,
    public_brand_card_enabled=case when p_patch ? 'public_brand_card_enabled' then (p_patch->>'public_brand_card_enabled')::boolean else public_brand_card_enabled end,
    price_verified_at=case when p_patch ?| array['price','private_price','nsfas_price'] then null else price_verified_at end,
    price_verified_by=case when p_patch ?| array['price','private_price','nsfas_price'] then null else price_verified_by end,
    updated_at=now()
  where id=p_residence_id;

  insert into public.residence_profile_change_log(residence_id,actor_user_id,actor_type,changed_fields,patch)
  values(p_residence_id,auth.uid(),'residence',v_changed,p_patch);
  v_quality:=public.refresh_residence_data_quality(p_residence_id);
  return jsonb_build_object('ok',true,'quality',v_quality);
end $$;
revoke all on function public.residence_portal_update_profile(uuid,jsonb) from public,anon;
grant execute on function public.residence_portal_update_profile(uuid,jsonb) to authenticated;

-- Public residence asset bucket, writable only inside an authorised residence folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('residence-assets','residence-assets',true,10485760,array['image/jpeg','image/png','image/webp']::text[])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "public read residence assets" on storage.objects;
create policy "public read residence assets" on storage.objects for select to public using (bucket_id='residence-assets');
drop policy if exists "residence upload own assets" on storage.objects;
create policy "residence upload own assets" on storage.objects for insert to authenticated with check (bucket_id='residence-assets' and ((storage.foldername(name))[1]::uuid=public.get_user_residence_id() or public.can_manage_growth()));
drop policy if exists "residence update own assets" on storage.objects;
create policy "residence update own assets" on storage.objects for update to authenticated using (bucket_id='residence-assets' and ((storage.foldername(name))[1]::uuid=public.get_user_residence_id() or public.can_manage_growth())) with check (bucket_id='residence-assets' and ((storage.foldername(name))[1]::uuid=public.get_user_residence_id() or public.can_manage_growth()));
drop policy if exists "residence delete own assets" on storage.objects;
create policy "residence delete own assets" on storage.objects for delete to authenticated using (bucket_id='residence-assets' and ((storage.foldername(name))[1]::uuid=public.get_user_residence_id() or public.can_manage_growth()));

-- Residence-specific recruiter programme.
create table if not exists public.residence_recruitment_programs (
  residence_id uuid primary key references public.residences(id) on delete cascade,
  enabled boolean not null default false,
  residence_message text,
  commission_amount numeric(12,2) not null default 200,
  bonus_target integer not null default 10,
  bonus_amount numeric(12,2) not null default 3000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.recruiter_residence_assignments (
  id uuid primary key default gen_random_uuid(),
  recruiter_user_id uuid not null references auth.users(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete cascade,
  status text not null default 'active' check(status in('active','paused','ended')),
  selected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(recruiter_user_id,residence_id)
);
create table if not exists public.recruiter_residence_links (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.recruiter_residence_assignments(id) on delete cascade,
  recruiter_user_id uuid not null references auth.users(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete cascade,
  referral_code text not null,
  link_key text not null unique default lower(substr(replace(gen_random_uuid()::text,'-',''),1,14)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(recruiter_user_id,residence_id)
);
create index if not exists recruiter_residence_links_residence_idx on public.recruiter_residence_links(residence_id,is_active);
create index if not exists recruiter_residence_links_recruiter_idx on public.recruiter_residence_links(recruiter_user_id,is_active);

alter table public.residence_recruitment_programs enable row level security;
alter table public.recruiter_residence_assignments enable row level security;
alter table public.recruiter_residence_links enable row level security;
drop policy if exists "growth manage residence recruitment programs" on public.residence_recruitment_programs;
create policy "growth manage residence recruitment programs" on public.residence_recruitment_programs for all to authenticated using(public.can_manage_growth()) with check(public.can_manage_growth());
drop policy if exists "residence read own recruitment program" on public.residence_recruitment_programs;
create policy "residence read own recruitment program" on public.residence_recruitment_programs for select to authenticated using(public.is_authorized_residence_user(residence_id));
drop policy if exists "recruiter read own assignments" on public.recruiter_residence_assignments;
create policy "recruiter read own assignments" on public.recruiter_residence_assignments for select to authenticated using(recruiter_user_id=auth.uid() or public.can_manage_growth() or public.is_authorized_residence_user(residence_id));
drop policy if exists "recruiter read own links" on public.recruiter_residence_links;
create policy "recruiter read own links" on public.recruiter_residence_links for select to authenticated using(recruiter_user_id=auth.uid() or public.can_manage_growth() or public.is_authorized_residence_user(residence_id));

insert into public.residence_recruitment_programs(residence_id,enabled,residence_message)
select id,recruiter_opt_in,recruiter_note from public.residences
on conflict(residence_id) do nothing;

create or replace function public.residence_portal_set_recruitment(p_residence_id uuid,p_enabled boolean,p_message text default null)
returns jsonb language plpgsql security definer set search_path='' set row_security='off' as $$
begin
  if not public.is_authorized_residence_user(p_residence_id) then raise exception 'Not authorized'; end if;
  update public.residences set recruiter_opt_in=p_enabled,recruiter_note=nullif(trim(p_message),''),updated_at=now() where id=p_residence_id;
  insert into public.residence_recruitment_programs(residence_id,enabled,residence_message,updated_at)
  values(p_residence_id,p_enabled,nullif(trim(p_message),''),now())
  on conflict(residence_id) do update set enabled=excluded.enabled,residence_message=excluded.residence_message,updated_at=now();
  return jsonb_build_object('ok',true,'enabled',p_enabled);
end $$;
revoke all on function public.residence_portal_set_recruitment(uuid,boolean,text) from public,anon;
grant execute on function public.residence_portal_set_recruitment(uuid,boolean,text) to authenticated;

drop view if exists public.recruitable_residences_v;
create view public.recruitable_residences_v with (security_barrier=true) as
select r.id,r.name,r.slug,r.address,r.place_label,r.city,r.campus,r.province,r.cover_image_url,r.studio_image_url,r.image_url,r.available_spots,r.capacity,r.accepts_nsfas,r.accepts_private,r.accepts_tvet,r.accepts_university,r.data_quality_score,
       p.commission_amount,p.bonus_target,p.bonus_amount,p.residence_message
from public.residences r join public.residence_recruitment_programs p on p.residence_id=r.id
where p.enabled=true and r.is_visible is distinct from false;
grant select on public.recruitable_residences_v to authenticated;

create or replace function public.recruiter_select_residence(p_residence_id uuid)
returns jsonb
language plpgsql security definer set search_path='' set row_security='off' as $$
declare
  v_code public.referral_codes;
  v_assignment uuid;
  v_link public.recruiter_residence_links%rowtype;
  v_res public.residences%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.referral_agents where user_id=auth.uid() and status='approved') then raise exception 'Approved recruiter access required'; end if;
  if not exists(select 1 from public.residence_recruitment_programs where residence_id=p_residence_id and enabled=true) then raise exception 'This residence is not open for recruitment'; end if;
  select * into v_res from public.residences where id=p_residence_id and is_visible is distinct from false;
  if not found then raise exception 'Residence unavailable'; end if;
  select public.get_or_create_referral_code() into v_code;
  insert into public.recruiter_residence_assignments(recruiter_user_id,residence_id,status,updated_at)
  values(auth.uid(),p_residence_id,'active',now())
  on conflict(recruiter_user_id,residence_id) do update set status='active',updated_at=now()
  returning id into v_assignment;
  insert into public.recruiter_residence_links(assignment_id,recruiter_user_id,residence_id,referral_code,is_active,updated_at)
  values(v_assignment,auth.uid(),p_residence_id,v_code.code,true,now())
  on conflict(recruiter_user_id,residence_id) do update set assignment_id=excluded.assignment_id,referral_code=excluded.referral_code,is_active=true,updated_at=now()
  returning * into v_link;
  return jsonb_build_object('linkKey',v_link.link_key,'code',v_link.referral_code,'residenceId',v_res.id,'residenceName',v_res.name,'slug',coalesce(v_res.slug,v_res.id::text));
end $$;
revoke all on function public.recruiter_select_residence(uuid) from public,anon;
grant execute on function public.recruiter_select_residence(uuid) to authenticated;

create or replace function public.capture_residence_referral_click(_link_key text,_visitor_id text default null,_landing_url text default null,_user_agent text default null)
returns jsonb
language plpgsql security definer set search_path='' set row_security='off' as $$
declare
  v_link public.recruiter_residence_links%rowtype;
  v_res public.residences%rowtype;
  v_session uuid;
  v_agent_name text;
begin
  select * into v_link from public.recruiter_residence_links where link_key=lower(trim(_link_key)) and is_active=true;
  if not found or not exists(select 1 from public.residence_recruitment_programs where residence_id=v_link.residence_id and enabled=true) then return null; end if;
  select * into v_res from public.residences where id=v_link.residence_id and is_visible is distinct from false;
  if not found then return null; end if;
  select public.capture_referral_click(v_link.referral_code,_visitor_id,_landing_url,_user_agent) into v_session;
  select coalesce(p.full_name,'ResKonnect Recruiter') into v_agent_name from public.profiles p where p.id=v_link.recruiter_user_id;
  insert into public.referral_events(program_key,event_type,referral_code,referral_agent_user_id,residence_id,session_id,url,metadata)
  values('student_recruitment','residence_link_click',v_link.referral_code,v_link.recruiter_user_id,v_link.residence_id,v_session,_landing_url,jsonb_build_object('link_key',v_link.link_key,'visitor_id',_visitor_id)) ;
  return jsonb_build_object('sessionId',v_session,'code',v_link.referral_code,'agentName',coalesce(v_agent_name,'ResKonnect Recruiter'),'residenceId',v_res.id,'residenceName',v_res.name,'slug',coalesce(v_res.slug,v_res.id::text));
end $$;
revoke all on function public.capture_residence_referral_click(text,text,text,text) from public;
grant execute on function public.capture_residence_referral_click(text,text,text,text) to anon,authenticated;

create or replace function public.residence_recruitment_summary(p_residence_id uuid,p_days integer default 30)
returns jsonb language plpgsql security definer set search_path='' set row_security='off' as $$
begin
  if not (public.is_authorized_residence_user(p_residence_id) or public.can_manage_growth()) then raise exception 'Not authorized'; end if;
  return jsonb_build_object(
    'recruiters',(select count(*) from public.recruiter_residence_assignments where residence_id=p_residence_id and status='active'),
    'clicks',(select count(*) from public.referral_events where residence_id=p_residence_id and event_type='residence_link_click' and created_at>=now()-make_interval(days=>greatest(p_days,1))),
    'applications',(select count(*) from public.application_referrals ar join public.applications a on a.id=ar.application_id where a.residence_id=p_residence_id and ar.created_at>=now()-make_interval(days=>greatest(p_days,1))),
    'placements',(select count(*) from public.residence_leads where residence_id=p_residence_id and stage='placed' and updated_at>=now()-make_interval(days=>greatest(p_days,1)))
  );
end $$;
revoke all on function public.residence_recruitment_summary(uuid,integer) from public,anon;
grant execute on function public.residence_recruitment_summary(uuid,integer) to authenticated;

-- Unified partnership God Mode.
create table if not exists public.partnerships (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  partnership_type text not null default 'strategic',
  status text not null default 'active' check(status in('prospect','active','paused','ended')),
  visibility text not null default 'public' check(visibility in('public','private','internal')),
  public_path text,
  source_table text,
  source_id text,
  commercial_model jsonb not null default '{}'::jsonb,
  conversion_goal text,
  notes text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.partnership_attributions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partnerships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text,
  source text not null default 'partner_campaign',
  first_attributed_at timestamptz not null default now(),
  last_attributed_at timestamptz not null default now(),
  unique(partner_id,user_id)
);
create table if not exists public.partnership_conversion_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partnerships(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  residence_id uuid references public.residences(id) on delete set null,
  value numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists partnership_conversion_event_dedupe_idx on public.partnership_conversion_events(partner_id,event_type,entity_type,entity_id) where entity_id is not null;
create index if not exists partnership_conversion_partner_idx on public.partnership_conversion_events(partner_id,created_at desc);

alter table public.growth_events add column if not exists partner_slug text;
create index if not exists growth_events_partner_slug_idx on public.growth_events(partner_slug,occurred_at desc) where partner_slug is not null;
alter table public.partnerships enable row level security;
alter table public.partnership_attributions enable row level security;
alter table public.partnership_conversion_events enable row level security;
drop policy if exists "public read visible partnerships" on public.partnerships;
create policy "public read visible partnerships" on public.partnerships for select to public using(visibility='public' and status='active');
drop policy if exists "growth manage partnerships" on public.partnerships;
create policy "growth manage partnerships" on public.partnerships for all to authenticated using(public.can_manage_growth()) with check(public.can_manage_growth());
drop policy if exists "users read own partnership attribution" on public.partnership_attributions;
create policy "users read own partnership attribution" on public.partnership_attributions for select to authenticated using(user_id=auth.uid() or public.can_manage_growth());
drop policy if exists "growth read partnership conversions" on public.partnership_conversion_events;
create policy "growth read partnership conversions" on public.partnership_conversion_events for select to authenticated using(public.can_manage_growth());

insert into public.partnerships(slug,name,partnership_type,status,visibility,public_path,source_table,source_id,conversion_goal)
values
 ('start-to-up','Start To Up','founding_company','active','public','/partners','partner_showcase','start-to-up','Platform visibility and ecosystem growth'),
 ('tut','Tshwane University of Technology','institutional_ecosystem','active','public','/partners','partner_showcase','tut','Student journey visibility and conversions'),
 ('tumelo-career-education','Tumelo','strategic_collaboration','active','public','/career-education/tumelo','partner_content','tumelo-career-education','Career and education engagement')
on conflict(slug) do update set name=excluded.name,partnership_type=excluded.partnership_type,public_path=excluded.public_path,source_table=excluded.source_table,source_id=excluded.source_id,updated_at=now();

create or replace function public.attribute_partnership(p_partner_slug text,p_session_id text default null,p_source text default 'partner_campaign')
returns boolean language plpgsql security definer set search_path='' set row_security='off' as $$
declare v_partner uuid;
begin
  if auth.uid() is null then return false; end if;
  select id into v_partner from public.partnerships where slug=lower(trim(p_partner_slug)) and status='active';
  if v_partner is null then return false; end if;
  insert into public.partnership_attributions(partner_id,user_id,session_id,source)
  values(v_partner,auth.uid(),p_session_id,coalesce(nullif(p_source,''),'partner_campaign'))
  on conflict(partner_id,user_id) do update set session_id=coalesce(excluded.session_id,public.partnership_attributions.session_id),source=excluded.source,last_attributed_at=now();
  return true;
end $$;
revoke all on function public.attribute_partnership(text,text,text) from public,anon;
grant execute on function public.attribute_partnership(text,text,text) to authenticated;

create or replace function public.record_partnership_conversion()
returns trigger language plpgsql security definer set search_path='' set row_security='off' as $$
declare
  v_user uuid;
  v_residence uuid;
  v_entity uuid;
  v_event text;
  a record;
begin
  if tg_table_name='applications' then
    if tg_op<>'INSERT' then return new; end if;
    v_user:=new.user_id; v_residence:=new.residence_id; v_entity:=new.id; v_event:='application';
  elsif tg_table_name='accommodation_reservations' then
    if tg_op<>'INSERT' then return new; end if;
    v_user:=new.user_id; v_residence:=new.residence_id; v_entity:=new.id; v_event:='reservation';
  elsif tg_table_name='residence_leads' then
    if new.stage<>'placed' or (tg_op='UPDATE' and old.stage='placed') then return new; end if;
    v_user:=new.user_id; v_residence:=new.residence_id; v_entity:=new.id; v_event:='placement';
  else return new; end if;
  if v_user is null then return new; end if;
  for a in select pa.partner_id from public.partnership_attributions pa join public.partnerships p on p.id=pa.partner_id where pa.user_id=v_user and p.status='active' order by pa.last_attributed_at desc limit 3 loop
    insert into public.partnership_conversion_events(partner_id,user_id,event_type,entity_type,entity_id,residence_id,metadata)
    values(a.partner_id,v_user,v_event,tg_table_name,v_entity,v_residence,jsonb_build_object('source','automatic')) on conflict do nothing;
  end loop;
  return new;
end $$;
drop trigger if exists trg_partnership_application_conversion on public.applications;
create trigger trg_partnership_application_conversion after insert on public.applications for each row execute function public.record_partnership_conversion();
drop trigger if exists trg_partnership_reservation_conversion on public.accommodation_reservations;
create trigger trg_partnership_reservation_conversion after insert on public.accommodation_reservations for each row execute function public.record_partnership_conversion();
drop trigger if exists trg_partnership_placement_conversion on public.residence_leads;
create trigger trg_partnership_placement_conversion after insert or update of stage on public.residence_leads for each row execute function public.record_partnership_conversion();

create or replace function public.admin_partnership_command_center(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' set row_security='off' as $$
declare v_days integer:=greatest(coalesce(p_days,30),1);
begin
  if not public.can_manage_growth() then raise exception 'Not authorized'; end if;
  return jsonb_build_object(
    'generatedAt',now(),
    'periodDays',v_days,
    'totals',jsonb_build_object(
      'activePartners',(select count(*) from public.partnerships where status='active'),
      'publicPartners',(select count(*) from public.partnerships where status='active' and visibility='public'),
      'attributedUsers',(select count(distinct user_id) from public.partnership_attributions where last_attributed_at>=now()-make_interval(days=>v_days)),
      'partnerPageViews',(select count(*) from public.growth_events where partner_slug is not null and occurred_at>=now()-make_interval(days=>v_days)),
      'partnerApplications',(select count(*) from public.partnership_conversion_events where event_type='application' and created_at>=now()-make_interval(days=>v_days)),
      'partnerReservations',(select count(*) from public.partnership_conversion_events where event_type='reservation' and created_at>=now()-make_interval(days=>v_days)),
      'partnerPlacements',(select count(*) from public.partnership_conversion_events where event_type='placement' and created_at>=now()-make_interval(days=>v_days)),
      'activeRecruiters',(select count(*) from public.referral_agents where status='approved'),
      'recruitableResidences',(select count(*) from public.residence_recruitment_programs where enabled=true),
      'activeRecruiterResidenceLinks',(select count(*) from public.recruiter_residence_assignments where status='active'),
      'creatorPartners',(select count(*) from public.creator_partners where status='active')
    ),
    'partners',coalesce((select jsonb_agg(x order by x.placements desc,x.views desc) from (
      select p.id,p.slug,p.name,p.partnership_type,p.status,p.visibility,p.public_path,
        (select count(*) from public.growth_events ge where ge.partner_slug=p.slug and ge.occurred_at>=now()-make_interval(days=>v_days)) views,
        (select count(*) from public.partnership_attributions pa where pa.partner_id=p.id and pa.last_attributed_at>=now()-make_interval(days=>v_days)) attributed_users,
        (select count(*) from public.partnership_conversion_events ce where ce.partner_id=p.id and ce.event_type='application' and ce.created_at>=now()-make_interval(days=>v_days)) applications,
        (select count(*) from public.partnership_conversion_events ce where ce.partner_id=p.id and ce.event_type='reservation' and ce.created_at>=now()-make_interval(days=>v_days)) reservations,
        (select count(*) from public.partnership_conversion_events ce where ce.partner_id=p.id and ce.event_type='placement' and ce.created_at>=now()-make_interval(days=>v_days)) placements
      from public.partnerships p
    ) x),'[]'::jsonb),
    'recruitment',coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select r.id,r.name,r.data_quality_score,r.recruiter_opt_in,
        count(distinct a.recruiter_user_id) filter(where a.status='active') recruiters,
        (select count(*) from public.referral_events re where re.residence_id=r.id and re.event_type='residence_link_click' and re.created_at>=now()-make_interval(days=>v_days)) clicks,
        (select count(*) from public.application_referrals ar join public.applications ap on ap.id=ar.application_id where ap.residence_id=r.id and ar.created_at>=now()-make_interval(days=>v_days)) applications,
        (select count(*) from public.residence_leads rl where rl.residence_id=r.id and rl.stage='placed' and rl.updated_at>=now()-make_interval(days=>v_days)) placements
      from public.residences r left join public.recruiter_residence_assignments a on a.residence_id=r.id
      where r.recruiter_opt_in=true group by r.id order by clicks desc limit 50
    ) x),'[]'::jsonb)
  );
end $$;
revoke all on function public.admin_partnership_command_center(integer) from public,anon;
grant execute on function public.admin_partnership_command_center(integer) to authenticated;

-- Backfill profile quality and synchronise recruitment programme flags.
do $$ declare x record; begin
  for x in select id from public.residences loop perform public.refresh_residence_data_quality(x.id); end loop;
end $$;

notify pgrst,'reload schema';
