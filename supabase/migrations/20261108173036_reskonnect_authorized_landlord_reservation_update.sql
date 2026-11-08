-- Preserve authorized landlord callbacks while retaining direct student client guards.
create or replace function reskonnect_internal.student_reservation_guard()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if auth.uid() is null or public.is_platform_staff() or
    (tg_op='UPDATE' and public.is_authorized_residence_user(old.residence_id)) then
   return new;
 end if;
 if tg_op='INSERT' then
   if new.user_id is distinct from auth.uid() then
     raise exception 'Cannot submit another student account reservation' using errcode='42501';end if;
   if new.status<>'reserved' or new.academic_year<>2027 then
     raise exception 'Students may only submit 2027 reservation interest';end if;
   if new.room_id is not null or new.room_hold_id is not null or new.admin_notes is not null
      or new.residence_notes is not null or new.last_contacted_at is not null then
     raise exception 'Room allocation and residence administration are staff-only' using errcode='42501';end if;
   if not exists(select 1 from public.residences where id=new.residence_id
        and reservations_2027_open=true and is_visible=true) then
     raise exception '2027 reservation interest is closed for this residence';end if;
   if length(coalesce(new.notes,''))>1200 or length(coalesce(new.room_preference,''))>160 then
     raise exception 'Student reservation notes are too long';end if;
   -- Never let a client backdate a reservation and forge the response deadline.
   new.created_at:=now();
   new.updated_at:=now();
   new.source:='student_reservation_journey';
 else
   if auth.uid() is distinct from old.user_id or auth.uid() is distinct from new.user_id then
     raise exception 'Cannot modify another student reservation' using errcode='42501';end if;
   if (old.residence_id,old.user_id,old.academic_year,old.academic_cycle,old.academic_period,
       old.room_id,old.room_hold_id,old.source,old.created_at,old.applicant_name)
      is distinct from
      (new.residence_id,new.user_id,new.academic_year,new.academic_cycle,new.academic_period,
       new.room_id,new.room_hold_id,new.source,new.created_at,new.applicant_name)
      or new.admin_notes is distinct from old.admin_notes
      or new.residence_notes is distinct from old.residence_notes
      or new.last_contacted_at is distinct from old.last_contacted_at then
     raise exception 'Only staff can change allocation, identity and internal fields' using errcode='42501';end if;
   if old.status not in ('reserved','cancelled') and new is distinct from old then
     raise exception 'This reservation is being managed by staff and cannot be reset by its applicant';end if;
   if new.status<>old.status and not (
      (old.status='reserved' and new.status='cancelled')
       or (old.status='cancelled' and new.status='reserved'
         and exists(select 1 from public.residences where id=old.residence_id and reservations_2027_open=true))
      ) then
     raise exception 'Reservation approval and progression require staff review';end if;
   if length(coalesce(new.notes,''))>1200 or length(coalesce(new.room_preference,''))>160 then
     raise exception 'Student reservation notes are too long';end if;
 end if;
 return new;
end;
$fn$;
