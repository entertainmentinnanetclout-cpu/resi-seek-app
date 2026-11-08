-- ResKonnect Phases 1–3: one moderated listing workflow, shared service signals
-- and a public inventory projection. No existing residence records are modified
-- by this migration. Approval is a separate explicit admin action.

create table if not exists public.reskonnect_listing_studio_drafts (
  residence_id uuid primary key references public.residences(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  payload jsonb not null default '{}'::jsonb,
  step_index smallint not null default 0 check(step_index between 0 and 5),
  status text not null default 'draft' check(status in ('draft','submitted','changes_requested','approved')),
  reviewer_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_draft_payload_size check(octet_length(payload::text)<=90000)
);
create index if not exists rk_listing_draft_status_idx on public.reskonnect_listing_studio_drafts(status,updated_at desc);
alter table public.reskonnect_listing_studio_drafts enable row level security;
revoke all on public.reskonnect_listing_studio_drafts from public,anon,authenticated;
grant select,insert,update on public.reskonnect_listing_studio_drafts to authenticated;
grant all on public.reskonnect_listing_studio_drafts to service_role;

drop policy if exists rk_studio_read on public.reskonnect_listing_studio_drafts;
create policy rk_studio_read on public.reskonnect_listing_studio_drafts for select to authenticated
using (public.is_authorized_residence_user(residence_id) or public.has_role((select auth.uid()),'admin'::public.app_role));
drop policy if exists rk_studio_insert on public.reskonnect_listing_studio_drafts;
create policy rk_studio_insert on public.reskonnect_listing_studio_drafts for insert to authenticated
with check (
  owner_id=(select auth.uid()) and status='draft' and
  public.is_authorized_residence_user(residence_id)
);
drop policy if exists rk_studio_update on public.reskonnect_listing_studio_drafts;
create policy rk_studio_update on public.reskonnect_listing_studio_drafts for update to authenticated
using (
  (public.is_authorized_residence_user(residence_id) and status in ('draft','changes_requested','approved'))
  or public.has_role((select auth.uid()),'admin'::public.app_role)
)
with check (
  (public.is_authorized_residence_user(residence_id) and owner_id=(select auth.uid()) and status in ('draft','submitted'))
  or public.has_role((select auth.uid()),'admin'::public.app_role)
);

-- Validation on submission, including actual photo origin and room quantities.
-- It runs on every status transition, not only from the browser wizard.
create or replace function public.reskonnect_listing_submit_errors(p jsonb, rid uuid)
returns text[] language plpgsql stable set search_path=''
as $function$
declare errors text[]:='{}'; room jsonb; photo jsonb; total integer:=0; year int; prefix text;
begin
  if jsonb_typeof(p) is distinct from 'object' then return array['Invalid listing payload']; end if;
  if length(trim(coalesce(p->>'name','')))<3 then errors:=array_append(errors,'Property name is required'); end if;
  if length(trim(coalesce(p->>'city','')))<2 or length(trim(coalesce(p->>'place_label','')))<2 then
    errors:=array_append(errors,'City and public neighbourhood are required'); end if;
  if length(trim(coalesce(p->>'address','')))<5 then errors:=array_append(errors,'Property address is required for verification'); end if;
  if length(trim(coalesce(p->>'description','')))<80 then errors:=array_append(errors,'Description must be at least 80 characters'); end if;
  if jsonb_typeof(p->'rooms') is distinct from 'array' or (case when jsonb_typeof(p->'rooms')='array' then jsonb_array_length(p->'rooms') else 0 end)=0
    then errors:=array_append(errors,'Provide at least one real room type');
  else
    if jsonb_array_length(p->'rooms')>12 then errors:=array_append(errors,'Up to 12 room categories are supported'); end if;
    for room in select value from jsonb_array_elements(p->'rooms') loop
      if length(trim(coalesce(room->>'name','')))<2 then errors:=array_append(errors,'Every room type needs a name'); end if;
      if coalesce(room->>'capacity','') !~ '^[0-9]{1,4}$'
       or coalesce(room->>'available_beds','') !~ '^[0-9]{1,4}$' then
         errors:=array_append(errors,'Room capacity/available beds must be whole numbers');
      elsif (room->>'capacity')::int<1 or (room->>'available_beds')::int>(room->>'capacity')::int then
         errors:=array_append(errors,'Room availability cannot exceed capacity');
      else total:=total+(room->>'capacity')::int; end if;
      if coalesce(room->>'private_price','') !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$'
        or (case when coalesce(room->>'private_price','') ~ '^[0-9]{1,8}(\.[0-9]{1,2})?
         errors:=array_append(errors,'Every room type requires a valid private monthly rate'); end if;
    end loop;
    if total>10000 then errors:=array_append(errors,'Capacity exceeds platform safety limits'); end if;
    if (select count(*) from (select lower(trim(value->>'name')) n
      from jsonb_array_elements(p->'rooms')) names)
      <> (select count(distinct lower(trim(value->>'name'))) from jsonb_array_elements(p->'rooms'))
      then errors:=array_append(errors,'Room type names must be unique'); end if;
  end if;
  if jsonb_typeof(p->'photos') is distinct from 'array' or (case when jsonb_typeof(p->'photos')='array' then jsonb_array_length(p->'photos') else 0 end)<3
    then errors:=array_append(errors,'Upload at least three genuine residence photos');
  else
    if jsonb_array_length(p->'photos')>30 then errors:=array_append(errors,'Maximum 30 listing photos'); end if;
    prefix:='https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/residence-assets/'||rid::text||'/';
    for photo in select value from jsonb_array_elements(p->'photos') loop
      if left(coalesce(photo->>'url',''),length(prefix))<>prefix
         or coalesce(photo->>'url','') !~* '\.(jpg|jpeg|png|webp)$'
         or length(photo->>'url')>1200 then
        errors:=array_append(errors,'Every photo must be uploaded to this residence secure folder');
      end if;
    end loop;
  end if;
  if length(trim(coalesce(p->>'lease_period','')))<2 then errors:=array_append(errors,'Lease duration is required'); end if;
  if coalesce(p->>'move_in_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then errors:=array_append(errors,'Provide a valid move-in date'); end if;
  if coalesce(p->>'agree_terms','false')<>'true' then errors:=array_append(errors,'Confirm listing terms'); end if;
  if coalesce(p->>'verification_method','') not in ('property_documents','staff_review')
    then errors:=array_append(errors,'Choose a property verification route'); end if;
  if coalesce(p->>'academic_year','') !~ '^[0-9]{4}$' then
    errors:=array_append(errors,'Academic year is required');
  else
    year:=(p->>'academic_year')::int;
    if year<2026 or year>2100 then errors:=array_append(errors,'Unsupported academic year'); end if;
  end if;
  return errors;
end;
$function$;
revoke all on function public.reskonnect_listing_submit_errors(jsonb,uuid) from public,anon;
grant execute on function public.reskonnect_listing_submit_errors(jsonb,uuid) to authenticated,service_role;

create or replace function public.reskonnect_listing_guard()
returns trigger language plpgsql security invoker set search_path=''
as $function$
declare isadmin boolean; failures text[];
begin
 isadmin:=public.has_role(auth.uid(),'admin'::public.app_role);
 if tg_op='UPDATE' and not isadmin then
   if new.residence_id is distinct from old.residence_id or
      new.owner_id is distinct from old.owner_id or
      new.reviewer_note is distinct from old.reviewer_note or
      new.reviewed_by is distinct from old.reviewed_by or
      new.reviewed_at is distinct from old.reviewed_at then
     raise exception 'Residence owners cannot modify review decisions or ownership';
   end if;
 end if;
 if not isadmin and new.status not in ('draft','submitted')
    then raise exception 'Only an administrator may approve or request changes'; end if;
 if new.status='submitted' and (tg_op='INSERT' or old.status is distinct from 'submitted') then
   failures:=public.reskonnect_listing_submit_errors(new.payload,new.residence_id);
   if array_length(failures,1)>0 then raise exception 'Listing needs corrections: %',array_to_string(failures,'; '); end if;
   new.submitted_at:=now();
 end if;
 new.updated_at:=now();
 if tg_op='UPDATE' then new.revision:=old.revision+1; end if;
 return new;
end;
$function$;
drop trigger if exists rk_studio_guard on public.reskonnect_listing_studio_drafts;
create trigger rk_studio_guard before insert or update on public.reskonnect_listing_studio_drafts
for each row execute function public.reskonnect_listing_guard();

-- Shared immutable operational signals, scoped to the affected residence.
create schema if not exists reskonnect_internal;
revoke all on schema reskonnect_internal from public,anon,authenticated;
create table if not exists public.reskonnect_service_events (
  id bigint generated always as identity primary key,
  residence_id uuid references public.residences(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_user_id uuid,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists rk_service_events_residence_idx on public.reskonnect_service_events(residence_id,occurred_at desc);
alter table public.reskonnect_service_events enable row level security;
revoke all on public.reskonnect_service_events from public,anon,authenticated;
grant select on public.reskonnect_service_events to authenticated;
grant all on public.reskonnect_service_events to service_role;
drop policy if exists rk_service_events_read on public.reskonnect_service_events;
create policy rk_service_events_read on public.reskonnect_service_events for select to authenticated
using (public.has_role((select auth.uid()),'admin'::public.app_role)
       or public.is_authorized_residence_user(residence_id));

create or replace function reskonnect_internal.track_residence_business_event()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare rid uuid; eid uuid; evt text;
begin
 rid:=case when tg_op='DELETE' then old.residence_id else new.residence_id end;
 eid:=case when tg_op='DELETE' then old.id else new.id end;
 evt:=case when tg_op='INSERT' then 'created' when tg_op='DELETE' then 'removed' else 'updated' end;
 insert into public.reskonnect_service_events(residence_id,entity_type,entity_id,action,actor_user_id,metadata)
 values(rid,tg_table_name,eid,evt,auth.uid(),
   jsonb_build_object('status',case when tg_op='DELETE' then to_jsonb(old)->>'status' else to_jsonb(new)->>'status' end));
 return coalesce(new,old);
end;
$function$;
revoke all on function reskonnect_internal.track_residence_business_event() from public,anon,authenticated;

create or replace function reskonnect_internal.track_listing_event()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 insert into public.reskonnect_service_events(residence_id,entity_type,entity_id,action,actor_user_id,metadata)
 values(new.residence_id,'listing_studio',new.residence_id,new.status,auth.uid(),
 jsonb_build_object('revision',new.revision));
 return new;
end;
$function$;
revoke all on function reskonnect_internal.track_listing_event() from public,anon,authenticated;

drop trigger if exists rk_studio_event on public.reskonnect_listing_studio_drafts;
create trigger rk_studio_event after insert or update of status,payload on public.reskonnect_listing_studio_drafts
for each row execute function reskonnect_internal.track_listing_event();
drop trigger if exists rk_room_inventory_event on public.residence_room_types;
create trigger rk_room_inventory_event after insert or update on public.residence_room_types
for each row execute function reskonnect_internal.track_residence_business_event();
drop trigger if exists rk_reservation_event on public.accommodation_reservations;
create trigger rk_reservation_event after insert or update of status,room_id,room_preference on public.accommodation_reservations
for each row execute function reskonnect_internal.track_residence_business_event();

-- Published media is platform-controlled. Review decisions can add and
-- reorder verified listing photos but residence users cannot directly publish
-- private documents or mark images as verified.
grant insert,update on public.resmap_residence_media to authenticated;
drop policy if exists rk_media_admin_insert on public.resmap_residence_media;
create policy rk_media_admin_insert on public.resmap_residence_media for insert to authenticated
with check (public.has_role((select auth.uid()),'admin'::public.app_role));
drop policy if exists rk_media_admin_update on public.resmap_residence_media;
create policy rk_media_admin_update on public.resmap_residence_media for update to authenticated
using (public.has_role((select auth.uid()),'admin'::public.app_role))
with check (public.has_role((select auth.uid()),'admin'::public.app_role));

-- Publish only from an explicit admin review. Inherited RLS and SQL checks
-- prevent landlords from granting their own trust/accreditation/promotion.
create or replace function public.reskonnect_review_listing(
 p_residence_id uuid,p_approve boolean,p_note text default null
) returns jsonb language plpgsql security invoker set search_path=''
as $function$
declare d public.reskonnect_listing_studio_drafts%rowtype; p jsonb; rr jsonb; photo jsonb;
  count_rooms int:=0; count_beds int:=0; minimum_price numeric:=null;
  current_year int; normalized_name text; price numeric; cap int; available int;
  photo_urls text[]:='{}'; label text; entry text;
begin
 if not public.has_role(auth.uid(),'admin'::public.app_role) then
   raise exception 'Admin review permission required' using errcode='42501';
 end if;
 select * into d from public.reskonnect_listing_studio_drafts where residence_id=p_residence_id for update;
 if not found or d.status<>'submitted' then
   raise exception 'This listing is not awaiting admin review';
 end if;
 if not p_approve then
   update public.reskonnect_listing_studio_drafts
      set status='changes_requested',reviewer_note=left(coalesce(p_note,'Please review your details.'),1500),
      reviewed_at=now(),reviewed_by=auth.uid()
    where residence_id=p_residence_id;
   return jsonb_build_object('status','changes_requested','residence_id',p_residence_id);
 end if;
 p:=d.payload;
 if array_length(public.reskonnect_listing_submit_errors(p,p_residence_id),1)>0 then
   raise exception 'Listing no longer passes publication checks';
 end if;
 current_year:=(p->>'academic_year')::int;
 for rr in select value from jsonb_array_elements(p->'rooms') loop
   count_rooms:=count_rooms+1;
   cap:=(rr->>'capacity')::int;available:=(rr->>'available_beds')::int;
   price:=(rr->>'private_price')::numeric;
   count_beds:=count_beds+cap;
   minimum_price:=least(coalesce(minimum_price,price),price);
   normalized_name:=trim(rr->>'name');
   update public.residence_room_types set capacity=cap,available_beds=least(available,cap),
      private_price=price,deposit=coalesce(nullif(rr->>'deposit','')::numeric,0),
      academic_year=current_year,landlord_confirmed_at=now(),landlord_confirmed_by=d.owner_id,
      is_active=true,updated_at=now()
    where residence_id=p_residence_id and academic_year=current_year and lower(name)=lower(normalized_name);
   if not found then
     insert into public.residence_room_types(residence_id,name,academic_year,capacity,available_beds,private_price,deposit,landlord_confirmed_at,landlord_confirmed_by)
     values(p_residence_id,normalized_name,current_year,cap,available,price,coalesce(nullif(rr->>'deposit','')::numeric,0),now(),d.owner_id);
   end if;
 end loop;
 update public.resmap_residence_media set is_primary=false where residence_id=p_residence_id and is_primary;
 for photo in select value from jsonb_array_elements(p->'photos') loop
   entry:=photo->>'url';
   photo_urls:=array_append(photo_urls,entry);
   label:=left(coalesce(photo->>'room_tag','Residence'),80);
   insert into public.resmap_residence_media(residence_id,media_type,title,url,is_primary,is_published,sort_order,metadata)
   values(p_residence_id,'photo',label,entry,array_length(photo_urls,1)=1,true,array_length(photo_urls,1),
       jsonb_build_object('source','reskonnect_listing_studio','room_tag',label))
   on conflict(residence_id,url) do update set
     title=excluded.title,sort_order=excluded.sort_order,
     is_primary=excluded.is_primary,is_published=true,metadata=excluded.metadata;
 end loop;
 update public.residences set
   name=left(trim(p->>'name'),160),
   city=left(trim(p->>'city'),120),
   place_label=left(trim(p->>'place_label'),160),
   province=left(coalesce(p->>'province',''),100),
   description=left(trim(p->>'description'),5000),
   campus=left(coalesce(p->>'campus',''),160),
   lease_period=left(p->>'lease_period',100),
   is_furnished=coalesce((p->>'is_furnished')::boolean,false),
   has_wifi=coalesce((p->>'has_wifi')::boolean,false),
   has_parking=coalesce((p->>'has_parking')::boolean,false),
   utilities_included=coalesce((p->>'utilities_included')::boolean,false),
   capacity=count_beds,available_spots=(select coalesce(sum(available_beds),0) from public.residence_room_types where residence_id=p_residence_id and academic_year=current_year and is_active=true),
   private_price=minimum_price,price=minimum_price,
   deposit_amount=coalesce((p->'rooms'->0->>'deposit')::numeric,0),
   pricing_year=current_year,
   cover_image_url=photo_urls[1],image_url=photo_urls[1],images=photo_urls,
   room_type=p->'rooms'->0->>'name',
   room_types=array(select value->>'name' from jsonb_array_elements(p->'rooms')),
   updated_at=now()
 where id=p_residence_id;
 if not found then raise exception 'Residence no longer exists';end if;
 update public.reskonnect_listing_studio_drafts set status='approved',reviewer_note=left(coalesce(p_note,'Approved for publishing'),1500),
    reviewed_at=now(),reviewed_by=auth.uid() where residence_id=p_residence_id;
 return jsonb_build_object('status','approved','residence_id',p_residence_id,'room_types',count_rooms,'beds',count_beds,'photos',array_length(photo_urls,1));
end;
$function$;
revoke all on function public.reskonnect_review_listing(uuid,boolean,text) from public,anon;
grant execute on function public.reskonnect_review_listing(uuid,boolean,text) to authenticated,service_role;

-- A single read model for visible inventory. Existing residences without room
-- types keep their existing *reported* available-spots data, not invented beds.
create or replace view public.reskonnect_discovery_inventory_v
with(security_invoker=true) as
select r.id as residence_id,r.name,r.city,r.place_label,r.campus,
       r.price as listing_price,r.available_spots as reported_available_spots,
       coalesce(rt.room_type_count,0) as room_type_count,
       case when rt.room_type_count>0 then rt.available_beds else r.available_spots end as visible_available_beds,
       case when rt.room_type_count>0 then rt.min_private_price else r.private_price end as visible_private_price,
       case when rt.room_type_count>0 then 'room_type_reported' else 'listing_reported' end as availability_source,
       r.is_visible
from public.residences r left join lateral (
 select count(*) as room_type_count,sum(available_beds)::int available_beds,
        min(private_price) min_private_price
 from public.residence_room_types t
 where t.residence_id=r.id and t.academic_year=coalesce(r.pricing_year,2027) and t.is_active
) rt on true where r.is_visible=true;
grant select on public.reskonnect_discovery_inventory_v to anon,authenticated;

comment on table public.reskonnect_listing_studio_drafts is 'Residence-owned draft, pending review, and approved listing snapshot. Submission does not automatically publish.';
comment on table public.reskonnect_service_events is 'Private service lifecycle events; no applicant personal data. Never expose unauthenticated.';
 then (room->>'private_price')::numeric else 0 end)<=0 then
         errors:=array_append(errors,'Every room type requires a valid private monthly rate'); end if;
    end loop;
    if total>10000 then errors:=array_append(errors,'Capacity exceeds platform safety limits'); end if;
    if (select count(*) from (select lower(trim(value->>'name')) n
      from jsonb_array_elements(p->'rooms')) names)
      <> (select count(distinct lower(trim(value->>'name'))) from jsonb_array_elements(p->'rooms'))
      then errors:=array_append(errors,'Room type names must be unique'); end if;
  end if;
  if jsonb_typeof(p->'photos') is distinct from 'array' or (case when jsonb_typeof(p->'photos')='array' then jsonb_array_length(p->'photos') else 0 end)<3
    then errors:=array_append(errors,'Upload at least three genuine residence photos');
  else
    if jsonb_array_length(p->'photos')>30 then errors:=array_append(errors,'Maximum 30 listing photos'); end if;
    prefix:='https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/residence-assets/'||rid::text||'/';
    for photo in select value from jsonb_array_elements(p->'photos') loop
      if left(coalesce(photo->>'url',''),length(prefix))<>prefix
         or coalesce(photo->>'url','') !~* '\.(jpg|jpeg|png|webp)$'
         or length(photo->>'url')>1200 then
        errors:=array_append(errors,'Every photo must be uploaded to this residence secure folder');
      end if;
    end loop;
  end if;
  if length(trim(coalesce(p->>'lease_period','')))<2 then errors:=array_append(errors,'Lease duration is required'); end if;
  if coalesce(p->>'move_in_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then errors:=array_append(errors,'Provide a valid move-in date'); end if;
  if coalesce(p->>'agree_terms','false')<>'true' then errors:=array_append(errors,'Confirm listing terms'); end if;
  if coalesce(p->>'verification_method','') not in ('property_documents','staff_review')
    then errors:=array_append(errors,'Choose a property verification route'); end if;
  if coalesce(p->>'academic_year','') !~ '^[0-9]{4}$' then
    errors:=array_append(errors,'Academic year is required');
  else
    year:=(p->>'academic_year')::int;
    if year<2026 or year>2100 then errors:=array_append(errors,'Unsupported academic year'); end if;
  end if;
  return errors;
end;
$function$;
revoke all on function public.reskonnect_listing_submit_errors(jsonb,uuid) from public,anon;
grant execute on function public.reskonnect_listing_submit_errors(jsonb,uuid) to authenticated,service_role;

create or replace function public.reskonnect_listing_guard()
returns trigger language plpgsql security invoker set search_path=''
as $function$
declare isadmin boolean; failures text[];
begin
 isadmin:=public.has_role(auth.uid(),'admin'::public.app_role);
 if tg_op='UPDATE' and not isadmin then
   if new.residence_id is distinct from old.residence_id or
      new.owner_id is distinct from old.owner_id or
      new.reviewer_note is distinct from old.reviewer_note or
      new.reviewed_by is distinct from old.reviewed_by or
      new.reviewed_at is distinct from old.reviewed_at then
     raise exception 'Residence owners cannot modify review decisions or ownership';
   end if;
 end if;
 if not isadmin and new.status not in ('draft','submitted')
    then raise exception 'Only an administrator may approve or request changes'; end if;
 if new.status='submitted' and (tg_op='INSERT' or old.status is distinct from 'submitted') then
   failures:=public.reskonnect_listing_submit_errors(new.payload,new.residence_id);
   if array_length(failures,1)>0 then raise exception 'Listing needs corrections: %',array_to_string(failures,'; '); end if;
   new.submitted_at:=now();
 end if;
 new.updated_at:=now();
 if tg_op='UPDATE' then new.revision:=old.revision+1; end if;
 return new;
end;
$function$;
drop trigger if exists rk_studio_guard on public.reskonnect_listing_studio_drafts;
create trigger rk_studio_guard before insert or update on public.reskonnect_listing_studio_drafts
for each row execute function public.reskonnect_listing_guard();

-- Shared immutable operational signals, scoped to the affected residence.
create schema if not exists reskonnect_internal;
revoke all on schema reskonnect_internal from public,anon,authenticated;
create table if not exists public.reskonnect_service_events (
  id bigint generated always as identity primary key,
  residence_id uuid references public.residences(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_user_id uuid,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists rk_service_events_residence_idx on public.reskonnect_service_events(residence_id,occurred_at desc);
alter table public.reskonnect_service_events enable row level security;
revoke all on public.reskonnect_service_events from public,anon,authenticated;
grant select on public.reskonnect_service_events to authenticated;
grant all on public.reskonnect_service_events to service_role;
drop policy if exists rk_service_events_read on public.reskonnect_service_events;
create policy rk_service_events_read on public.reskonnect_service_events for select to authenticated
using (public.has_role((select auth.uid()),'admin'::public.app_role)
       or public.is_authorized_residence_user(residence_id));

create or replace function reskonnect_internal.track_residence_business_event()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare rid uuid; eid uuid; evt text;
begin
 rid:=case when tg_op='DELETE' then old.residence_id else new.residence_id end;
 eid:=case when tg_op='DELETE' then old.id else new.id end;
 evt:=case when tg_op='INSERT' then 'created' when tg_op='DELETE' then 'removed' else 'updated' end;
 insert into public.reskonnect_service_events(residence_id,entity_type,entity_id,action,actor_user_id,metadata)
 values(rid,tg_table_name,eid,evt,auth.uid(),
   jsonb_build_object('status',case when tg_op='DELETE' then to_jsonb(old)->>'status' else to_jsonb(new)->>'status' end));
 return coalesce(new,old);
end;
$function$;
revoke all on function reskonnect_internal.track_residence_business_event() from public,anon,authenticated;

create or replace function reskonnect_internal.track_listing_event()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 insert into public.reskonnect_service_events(residence_id,entity_type,entity_id,action,actor_user_id,metadata)
 values(new.residence_id,'listing_studio',new.residence_id,new.status,auth.uid(),
 jsonb_build_object('revision',new.revision));
 return new;
end;
$function$;
revoke all on function reskonnect_internal.track_listing_event() from public,anon,authenticated;

drop trigger if exists rk_studio_event on public.reskonnect_listing_studio_drafts;
create trigger rk_studio_event after insert or update of status,payload on public.reskonnect_listing_studio_drafts
for each row execute function reskonnect_internal.track_listing_event();
drop trigger if exists rk_room_inventory_event on public.residence_room_types;
create trigger rk_room_inventory_event after insert or update on public.residence_room_types
for each row execute function reskonnect_internal.track_residence_business_event();
drop trigger if exists rk_reservation_event on public.accommodation_reservations;
create trigger rk_reservation_event after insert or update of status,room_id,room_preference on public.accommodation_reservations
for each row execute function reskonnect_internal.track_residence_business_event();

-- Publish only from an explicit admin review. Inherited RLS and SQL checks
-- prevent landlords from granting their own trust/accreditation/promotion.
create or replace function public.reskonnect_review_listing(
 p_residence_id uuid,p_approve boolean,p_note text default null
) returns jsonb language plpgsql security invoker set search_path=''
as $function$
declare d public.reskonnect_listing_studio_drafts%rowtype; p jsonb; rr jsonb; photo jsonb;
  count_rooms int:=0; count_beds int:=0; minimum_price numeric:=null;
  current_year int; normalized_name text; price numeric; cap int; available int;
  photo_urls text[]:='{}'; label text; entry text;
begin
 if not public.has_role(auth.uid(),'admin'::public.app_role) then
   raise exception 'Admin review permission required' using errcode='42501';
 end if;
 select * into d from public.reskonnect_listing_studio_drafts where residence_id=p_residence_id for update;
 if not found or d.status<>'submitted' then
   raise exception 'This listing is not awaiting admin review';
 end if;
 if not p_approve then
   update public.reskonnect_listing_studio_drafts
      set status='changes_requested',reviewer_note=left(coalesce(p_note,'Please review your details.'),1500),
      reviewed_at=now(),reviewed_by=auth.uid()
    where residence_id=p_residence_id;
   return jsonb_build_object('status','changes_requested','residence_id',p_residence_id);
 end if;
 p:=d.payload;
 if array_length(public.reskonnect_listing_submit_errors(p,p_residence_id),1)>0 then
   raise exception 'Listing no longer passes publication checks';
 end if;
 current_year:=(p->>'academic_year')::int;
 for rr in select value from jsonb_array_elements(p->'rooms') loop
   count_rooms:=count_rooms+1;
   cap:=(rr->>'capacity')::int;available:=(rr->>'available_beds')::int;
   price:=(rr->>'private_price')::numeric;
   count_beds:=count_beds+cap;
   minimum_price:=least(coalesce(minimum_price,price),price);
   normalized_name:=trim(rr->>'name');
   update public.residence_room_types set capacity=cap,available_beds=least(available,cap),
      private_price=price,deposit=coalesce(nullif(rr->>'deposit','')::numeric,0),
      academic_year=current_year,landlord_confirmed_at=now(),landlord_confirmed_by=d.owner_id,
      is_active=true,updated_at=now()
    where residence_id=p_residence_id and academic_year=current_year and lower(name)=lower(normalized_name);
   if not found then
     insert into public.residence_room_types(residence_id,name,academic_year,capacity,available_beds,private_price,deposit,landlord_confirmed_at,landlord_confirmed_by)
     values(p_residence_id,normalized_name,current_year,cap,available,price,coalesce(nullif(rr->>'deposit','')::numeric,0),now(),d.owner_id);
   end if;
 end loop;
 for photo in select value from jsonb_array_elements(p->'photos') loop
   entry:=photo->>'url';
   photo_urls:=array_append(photo_urls,entry);
   label:=left(coalesce(photo->>'room_tag','Residence'),80);
   insert into public.resmap_residence_media(residence_id,media_type,title,url,is_primary,is_published,sort_order,metadata)
   values(p_residence_id,'photo',label,entry,array_length(photo_urls,1)=1,true,array_length(photo_urls,1),
       jsonb_build_object('source','reskonnect_listing_studio','room_tag',label))
   on conflict(residence_id,url) do update set
     title=excluded.title,sort_order=excluded.sort_order,
     is_primary=excluded.is_primary,is_published=true,metadata=excluded.metadata;
 end loop;
 update public.residences set
   name=left(trim(p->>'name'),160),
   city=left(trim(p->>'city'),120),
   place_label=left(trim(p->>'place_label'),160),
   province=left(coalesce(p->>'province',''),100),
   description=left(trim(p->>'description'),5000),
   campus=left(coalesce(p->>'campus',''),160),
   lease_period=left(p->>'lease_period',100),
   is_furnished=coalesce((p->>'is_furnished')::boolean,false),
   has_wifi=coalesce((p->>'has_wifi')::boolean,false),
   has_parking=coalesce((p->>'has_parking')::boolean,false),
   utilities_included=coalesce((p->>'utilities_included')::boolean,false),
   capacity=count_beds,available_spots=(select coalesce(sum(available_beds),0) from public.residence_room_types where residence_id=p_residence_id and academic_year=current_year and is_active=true),
   private_price=minimum_price,price=minimum_price,
   deposit_amount=coalesce((p->'rooms'->0->>'deposit')::numeric,0),
   pricing_year=current_year,
   cover_image_url=photo_urls[1],image_url=photo_urls[1],images=photo_urls,
   room_type=p->'rooms'->0->>'name',
   room_types=array(select value->>'name' from jsonb_array_elements(p->'rooms')),
   updated_at=now()
 where id=p_residence_id;
 if not found then raise exception 'Residence no longer exists';end if;
 update public.reskonnect_listing_studio_drafts set status='approved',reviewer_note=left(coalesce(p_note,'Approved for publishing'),1500),
    reviewed_at=now(),reviewed_by=auth.uid() where residence_id=p_residence_id;
 return jsonb_build_object('status','approved','residence_id',p_residence_id,'room_types',count_rooms,'beds',count_beds,'photos',array_length(photo_urls,1));
end;
$function$;
revoke all on function public.reskonnect_review_listing(uuid,boolean,text) from public,anon;
grant execute on function public.reskonnect_review_listing(uuid,boolean,text) to authenticated,service_role;

-- A single read model for visible inventory. Existing residences without room
-- types keep their existing *reported* available-spots data, not invented beds.
create or replace view public.reskonnect_discovery_inventory_v
with(security_invoker=true) as
select r.id as residence_id,r.name,r.city,r.place_label,r.campus,
       r.price as listing_price,r.available_spots as reported_available_spots,
       coalesce(rt.room_type_count,0) as room_type_count,
       case when rt.room_type_count>0 then rt.available_beds else r.available_spots end as visible_available_beds,
       case when rt.room_type_count>0 then rt.min_private_price else r.private_price end as visible_private_price,
       case when rt.room_type_count>0 then 'verified_room_type_records' else 'listing_reported' end as availability_source,
       r.is_visible
from public.residences r left join lateral (
 select count(*) as room_type_count,sum(available_beds)::int available_beds,
        min(private_price) min_private_price
 from public.residence_room_types t
 where t.residence_id=r.id and t.academic_year=coalesce(r.pricing_year,2027) and t.is_active
) rt on true where r.is_visible=true;
grant select on public.reskonnect_discovery_inventory_v to anon,authenticated;

comment on table public.reskonnect_listing_studio_drafts is 'Residence-owned draft, pending review, and approved listing snapshot. Submission does not automatically publish.';
comment on table public.reskonnect_service_events is 'Private service lifecycle events; no applicant personal data. Never expose unauthenticated.';
