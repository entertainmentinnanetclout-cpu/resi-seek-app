-- Phase 4 controlled real-bed assignment.
-- A reservation interest does not allocate space. Only an authenticated staff
-- member with rights to this residence can hold a *verified physical room*.
-- PostgreSQL row locks serialize competing holds and confirmations.

create index if not exists rk_room_holds_room_active on public.resmap_room_holds(room_id,status,expires_at);
create index if not exists rk_confirmed_room_occupancy on public.accommodation_reservations(room_id,status) where room_id is not null;
create index if not exists rk_room_holds_student on public.resmap_room_holds(user_id,created_at desc);

create or replace function reskonnect_internal.guard_confirmed_reservation()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare h public.resmap_room_holds%rowtype; rm public.resmap_rooms%rowtype;
begin
 if new.status<>'confirmed' then return new;end if;
 if tg_op='UPDATE' and old.status='confirmed' then
  if new.room_id is distinct from old.room_id or new.room_hold_id is distinct from old.room_hold_id
   then raise exception 'Confirmed room assignments are immutable; cancel and rebook through the service desk';end if;
  return new;
 end if;
 if new.room_id is null or new.room_hold_id is null then
  raise exception 'A verified, active physical-room hold is required before confirmation';end if;
 select * into h from public.resmap_room_holds where id=new.room_hold_id for update;
 select * into rm from public.resmap_rooms where id=new.room_id for update;
 if not found or rm.inventory_kind<>'physical_room' or not rm.is_verified or not rm.reservable or not rm.is_published
   then raise exception 'Only verified and reservable physical rooms may be confirmed';end if;
 if h.id is null or h.status<>'active' or h.expires_at<=now() or h.user_id<>new.user_id
   or h.residence_id<>new.residence_id or h.room_id<>new.room_id or h.academic_year<>new.academic_year then
  raise exception 'The reservation hold is missing, expired or does not belong to this applicant';end if;
 if rm.residence_id<>new.residence_id then raise exception 'Room and residence do not match';end if;
 if (select count(*) from public.accommodation_reservations x where x.room_id=rm.id and x.status='confirmed' and x.id<>new.id)>=rm.capacity
   then raise exception 'This physical room is fully allocated';end if;
 return new;
end;
$fn$;
revoke all on function reskonnect_internal.guard_confirmed_reservation() from public,anon,authenticated;
create trigger aa_rk_real_room_confirmation_guard before insert or update of status,room_id,room_hold_id
on public.accommodation_reservations for each row execute function reskonnect_internal.guard_confirmed_reservation();

create or replace function public.reskonnect_hold_verified_room(p_reservation_id uuid,p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare r public.accommodation_reservations%rowtype; room public.resmap_rooms%rowtype;
 h public.resmap_room_holds%rowtype; taken int; pending int; usable int;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 select * into r from public.accommodation_reservations where id=p_reservation_id for update;
 if not found then raise exception 'Reservation not found';end if;
 if not (public.is_platform_staff() or public.is_authorized_residence_user(r.residence_id)) then
   raise exception 'Only authorized residence staff may allocate a room' using errcode='42501';end if;
 if r.status not in ('reserved','contacted','provisional_hold') then
   raise exception 'This reservation is not eligible for a new room hold';end if;
 if r.room_hold_id is not null then
   select * into h from public.resmap_room_holds where id=r.room_hold_id for update;
   if h.status='active' and h.expires_at>now() then
     raise exception 'Release the existing live room hold before switching rooms';end if;
   if h.status='active' then
     update public.resmap_room_holds set status='expired',updated_at=now() where id=h.id;
   end if;
 end if;
 select * into room from public.resmap_rooms where id=p_room_id for update;
 if not found or room.residence_id<>r.residence_id or room.inventory_kind<>'physical_room'
    or not room.reservable or not room.is_verified or not room.is_published
    or room.status not in ('available','limited') or room.capacity<=0 or room.available_beds<=0 then
   raise exception 'Choose a verified, published and available physical room in this residence';end if;
 select count(*) into taken from public.accommodation_reservations
  where room_id=room.id and status='confirmed';
 select count(*) into pending from public.resmap_room_holds
  where room_id=room.id and status='active' and expires_at>now();
 usable:=least(room.available_beds,room.capacity-taken-pending);
 if usable<=0 then raise exception 'No verified bed capacity remains in this room';end if;
 insert into public.resmap_room_holds(user_id,residence_id,room_id,academic_year,status,expires_at)
 values(r.user_id,r.residence_id,room.id,r.academic_year,'active',now()+interval '24 hours')
 returning * into h;
 update public.accommodation_reservations
   set room_id=room.id,room_hold_id=h.id,status='provisional_hold',updated_at=now()
 where id=r.id;
 insert into public.reskonnect_service_events(residence_id,entity_type,entity_id,action,actor_user_id,metadata)
 values(r.residence_id,'room_allocation',r.id,'provisional_hold',auth.uid(),
 jsonb_build_object('room_id',room.id,'hold_id',h.id,'expires_at',h.expires_at));
 return jsonb_build_object('status','provisional_hold','expires_at',h.expires_at,'room_id',room.id);
end;
$fn$;
revoke all on function public.reskonnect_hold_verified_room(uuid,uuid) from public,anon;
grant execute on function public.reskonnect_hold_verified_room(uuid,uuid) to authenticated;

create or replace function public.reskonnect_confirm_verified_room(p_reservation_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare r public.accommodation_reservations%rowtype; rm public.resmap_rooms%rowtype;
 h public.resmap_room_holds%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 select * into r from public.accommodation_reservations where id=p_reservation_id for update;
 if not found then raise exception 'Reservation not found';end if;
 if not (public.is_platform_staff() or public.is_authorized_residence_user(r.residence_id)) then
  raise exception 'Residence confirmation requires authorized staff' using errcode='42501';end if;
 if r.status<>'provisional_hold' or r.room_hold_id is null or r.room_id is null then
  raise exception 'Reservation must have a valid provisional physical-room hold';end if;
 select * into rm from public.resmap_rooms where id=r.room_id for update;
 select * into h from public.resmap_room_holds where id=r.room_hold_id for update;
 if not found or h.status<>'active' or h.expires_at<=now() or h.user_id<>r.user_id or h.room_id<>rm.id then
  raise exception 'Hold is missing, expired or does not match the reservation';end if;
 if rm.available_beds<=0 or
   (select count(*) from public.accommodation_reservations x where x.room_id=rm.id and x.status='confirmed')>=rm.capacity then
  raise exception 'No real verified capacity remains for confirmation';end if;
 -- The BEFORE UPDATE guard checks the live hold while still active.
 update public.accommodation_reservations set status='confirmed',updated_at=now() where id=r.id;
 update public.resmap_room_holds set status='converted',updated_at=now() where id=h.id;
 update public.resmap_rooms set available_beds=greatest(available_beds-1,0),updated_at=now() where id=rm.id;
 insert into public.reskonnect_service_events(residence_id,entity_type,entity_id,action,actor_user_id,metadata)
 values(r.residence_id,'room_allocation',r.id,'confirmed_physical_bed',auth.uid(),jsonb_build_object('room_id',rm.id));
 return jsonb_build_object('status','confirmed','room_id',rm.id);
end;
$fn$;
revoke all on function public.reskonnect_confirm_verified_room(uuid) from public,anon;
grant execute on function public.reskonnect_confirm_verified_room(uuid) to authenticated;

create or replace function public.reskonnect_release_verified_room_hold(p_reservation_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare r public.accommodation_reservations%rowtype;h public.resmap_room_holds%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 select * into r from public.accommodation_reservations where id=p_reservation_id for update;
 if not found or not (public.is_platform_staff() or public.is_authorized_residence_user(r.residence_id)) then
  raise exception 'Reservation not available to this staff member' using errcode='42501';end if;
 if r.status='confirmed' then raise exception 'Confirmed allocations must be cancelled through authorized status review';end if;
 if r.room_hold_id is null then return jsonb_build_object('status',r.status,'released',false);end if;
 select * into h from public.resmap_room_holds where id=r.room_hold_id for update;
 if h.id is not null and h.status='active' then
  update public.resmap_room_holds set status='released',updated_at=now() where id=h.id;end if;
 update public.accommodation_reservations
 set status='contacted',room_id=null,room_hold_id=null,updated_at=now()
 where id=r.id;
 return jsonb_build_object('status','contacted','released',true);
end;
$fn$;
revoke all on function public.reskonnect_release_verified_room_hold(uuid) from public,anon;
grant execute on function public.reskonnect_release_verified_room_hold(uuid) to authenticated;

-- Cancelling a confirmed placement returns its verified physical bed.
-- This applies to old AdminOS status controls too, preventing capacity drift.
create or replace function reskonnect_internal.release_changed_reservation()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare hold_status text;
begin
 if new.status=old.status then return new;end if;
 if old.status='confirmed' and new.status<>'confirmed' and old.room_id is not null then
    update public.resmap_rooms
       set available_beds=least(capacity,available_beds+1),updated_at=now()
    where id=old.room_id and inventory_kind='physical_room';
 end if;
 if old.status in ('confirmed','provisional_hold') and new.status not in ('confirmed','provisional_hold')
    and old.room_hold_id is not null then
    update public.resmap_room_holds set status='released',updated_at=now()
     where id=old.room_hold_id and status in ('active','converted');
 end if;
 return new;
end;
$fn$;
revoke all on function reskonnect_internal.release_changed_reservation() from public,anon,authenticated;
create trigger rk_release_room_when_reservation_changes after update of status on public.accommodation_reservations
for each row execute function reskonnect_internal.release_changed_reservation();

-- A normal UI student cannot forge a confirmed time. Only staff can
-- progress viewing requests; scheduled appointments require an actual time.
alter table public.viewing_requests add column if not exists confirmed_viewing_at timestamptz;
create or replace function public.reskonnect_progress_viewing(
 p_viewing_id uuid,p_status text,p_confirmed_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v public.viewing_requests%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 select * into v from public.viewing_requests where id=p_viewing_id for update;
 if not found or not(public.is_platform_staff() or public.is_authorized_residence_user(v.residence_id)) then
  raise exception 'Only authorized residence service staff can progress a viewing' using errcode='42501';end if;
 if not ((v.status='requested' and p_status in ('contacted','cancelled')) or
  (v.status='contacted' and p_status in ('scheduled','cancelled')) or
  (v.status='scheduled' and p_status in ('completed','cancelled','no_show')) or
  (v.status='no_show' and p_status='contacted')) then
   raise exception 'Invalid viewing status transition';end if;
 if p_status='scheduled' and (p_confirmed_at is null or p_confirmed_at<=now() or p_confirmed_at>now()+interval '180 days')
   then raise exception 'Confirm an actual future viewing date and time';end if;
 update public.viewing_requests set status=p_status,
  confirmed_viewing_at=case when p_status='scheduled' then p_confirmed_at
     when p_status='contacted' then null else confirmed_viewing_at end
 where id=p_viewing_id;
 insert into public.reskonnect_service_events(residence_id,entity_type,entity_id,action,actor_user_id,metadata)
 values(v.residence_id,'viewing_request',v.id,p_status,auth.uid(),jsonb_build_object('has_confirmed_time',p_status='scheduled'));
 return jsonb_build_object('status',p_status,'confirmed_viewing_at',p_confirmed_at);
end;
$fn$;
revoke all on function public.reskonnect_progress_viewing(uuid,text,timestamptz) from public,anon;
grant execute on function public.reskonnect_progress_viewing(uuid,text,timestamptz) to authenticated;

-- Student account notifications for actual viewing status changes only; no
-- email/WhatsApp send is triggered by this helper.
create or replace function reskonnect_internal.notify_viewing_progress()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if new.user_id is null or (tg_op='UPDATE' and old.status is not distinct from new.status) then return new;end if;
 insert into public.notifications(user_id,title,message,type,metadata,event_key)
 values(new.user_id,'Residence viewing request',
   case new.status when 'requested' then 'Your viewing request was recorded. A time has not yet been confirmed.'
    when 'scheduled' then 'Your residence viewing has been scheduled. Check your viewing details.'
    when 'cancelled' then 'Your viewing request was cancelled.'
    when 'completed' then 'Your viewing has been marked completed.'
    else 'Your viewing request status has changed.' end,
 'residence_viewing',
 jsonb_build_object('residence_id',new.residence_id,'viewing_id',new.id,'status',new.status),
 'viewing:'||new.id::text||':'||new.status);
 return new;
end;
$fn$;
revoke all on function reskonnect_internal.notify_viewing_progress() from public,anon,authenticated;
create trigger rk_viewing_notification after insert or update of status on public.viewing_requests
 for each row execute function reskonnect_internal.notify_viewing_progress();
