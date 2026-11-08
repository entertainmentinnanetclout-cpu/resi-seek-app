-- Phase 4 reconciliation of trusted room and viewing transitions.
-- Students may edit their own viewing notes under pre-existing RLS but may not
-- forge an arranged viewing, reassign ownership or set the confirmed time.
create or replace function reskonnect_internal.student_viewing_update_guard()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if auth.uid() is null or public.is_platform_staff() or public.is_authorized_residence_user(old.residence_id) then return new;end if;
 if auth.uid()=old.user_id and (new.user_id is distinct from old.user_id
    or new.residence_id is distinct from old.residence_id
    or new.status is distinct from old.status
    or new.confirmed_viewing_at is distinct from old.confirmed_viewing_at
    or new.assigned_staff_id is distinct from old.assigned_staff_id) then
   raise exception 'Only staff can change viewing ownership or progress' using errcode='42501';
 end if;
 return new;
end;
$fn$;
revoke all on function reskonnect_internal.student_viewing_update_guard() from public,anon,authenticated;
create trigger aa_rk_viewing_student_update_guard before update on public.viewing_requests
 for each row execute function reskonnect_internal.student_viewing_update_guard();


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
 select * into rm from public.resmap_rooms where id=new.room_id for update;
 select * into h from public.resmap_room_holds where id=new.room_hold_id for update;
 if not found or rm.available_beds<=0 or rm.inventory_kind<>'physical_room' or not rm.is_verified or not rm.reservable or not rm.is_published
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
 -- Shared reservation transition trigger converts the hold and decrements inventory exactly once.
 insert into public.reskonnect_service_events(residence_id,entity_type,entity_id,action,actor_user_id,metadata)
 values(r.residence_id,'room_allocation',r.id,'confirmed_physical_bed',auth.uid(),jsonb_build_object('room_id',rm.id));
 return jsonb_build_object('status','confirmed','room_id',rm.id);
end;
$fn$;

create or replace function reskonnect_internal.release_changed_reservation()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare hold_status text;
begin
 if new.status=old.status then return new;end if;
 if old.status<>'confirmed' and new.status='confirmed' then
   -- Every confirmation path, including old AdminOS controls, must convert
   -- its hold and consume exactly one real bed.
   update public.resmap_room_holds set status='converted',updated_at=now()
     where id=new.room_hold_id and status='active';
   if not found then raise exception 'Active hold disappeared before confirmation';end if;
   update public.resmap_rooms set available_beds=greatest(available_beds-1,0),updated_at=now()
     where id=new.room_id and inventory_kind='physical_room' and available_beds>0;
   if not found then raise exception 'Verified bed capacity unavailable';end if;
 end if;
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
 'viewing:'||new.id::text||':'||new.status)
 on conflict do nothing;
 return new;
end;
$fn$;

