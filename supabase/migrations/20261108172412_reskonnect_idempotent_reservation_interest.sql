-- An idempotent reservation-intent service: students can express or change
-- interest, but may never reset contacted/held/confirmed decisions by upsert.

create or replace function public.reskonnect_save_reservation_interest(
 p_residence_id uuid,p_funding_type text,p_room_preference text default null,p_notes text default null
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare existing public.accommodation_reservations%rowtype; rid uuid; changed boolean:=false;
begin
 if auth.uid() is null then raise exception 'Sign in to submit reservation interest' using errcode='42501';end if;
 if p_funding_type not in ('undecided','private','nsfas','other') then
  raise exception 'Select a valid funding type';end if;
 if length(coalesce(p_room_preference,''))>160 or length(coalesce(p_notes,''))>1200 then
  raise exception 'Reservation information is too long';end if;
 if not exists(select 1 from public.residences r where r.id=p_residence_id
  and r.is_visible=true and r.reservations_2027_open=true) then
  raise exception '2027 reservations are closed for this residence';end if;
 select * into existing from public.accommodation_reservations
 where user_id=auth.uid() and residence_id=p_residence_id and academic_year=2027
  and academic_cycle='unspecified' and academic_period=0 for update;
 if found then
  if existing.status in ('reserved','cancelled') then
    update public.accommodation_reservations
    set status='reserved',
     funding_type=p_funding_type,
     room_preference=nullif(left(trim(coalesce(p_room_preference,'')),160),''),
     notes=nullif(trim(coalesce(p_notes,'')),'')
    where id=existing.id;
    changed:=true;
    return jsonb_build_object('id',existing.id,'status','reserved','saved',changed);
  end if;
  return jsonb_build_object('id',existing.id,'status',existing.status,'saved',false,
     'reason','review_in_progress');
 end if;
 insert into public.accommodation_reservations
 (user_id,residence_id,academic_year,academic_cycle,academic_period,
  funding_type,room_preference,notes,status,source)
 values(auth.uid(),p_residence_id,2027,'unspecified',0,p_funding_type,
  nullif(trim(coalesce(p_room_preference,'')),''),
  nullif(trim(coalesce(p_notes,'')),''),'reserved','student_reservation_journey')
 returning id into rid;
 return jsonb_build_object('id',rid,'status','reserved','saved',true);
end;
$fn$;
revoke all on function public.reskonnect_save_reservation_interest(uuid,text,text,text) from public,anon;
grant execute on function public.reskonnect_save_reservation_interest(uuid,text,text,text) to authenticated;
comment on function public.reskonnect_save_reservation_interest(uuid,text,text,text)
 is 'Idempotent 2027 reservation interest; never downgrades a staff-progressed case.';

-- Clear stale room links when a staff member closes or releases an allocation.
-- Previous values in OLD remain available for the inventory-restoration trigger.
create or replace function reskonnect_internal.clear_released_room_links()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if old.status in ('confirmed','provisional_hold') and
    new.status not in ('confirmed','provisional_hold') then
   new.room_id:=null;
   new.room_hold_id:=null;
 end if;
 return new;
end;
$fn$;
revoke all on function reskonnect_internal.clear_released_room_links() from public,anon,authenticated;
create trigger zz_rk_clear_released_room_links before update of status on public.accommodation_reservations
for each row execute function reskonnect_internal.clear_released_room_links();
