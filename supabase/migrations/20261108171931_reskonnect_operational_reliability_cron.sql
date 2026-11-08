-- Reconcile all physical-bed status paths and automatically expire stale holds.

create or replace function reskonnect_internal.release_changed_reservation()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare after_beds integer;
begin
 if tg_op='INSERT' then
   if new.status='confirmed' then
     update public.resmap_room_holds set status='converted',updated_at=now()
       where id=new.room_hold_id and status='active';
     if not found then raise exception 'Missing active hold for inserted confirmation';end if;
     update public.resmap_rooms set available_beds=available_beds-1,
       status=case when available_beds=1 then 'full' else status end,
       updated_at=now()
       where id=new.room_id and inventory_kind='physical_room' and available_beds>0;
     if not found then raise exception 'No verified bed remains for direct confirmation';end if;
   end if;
   return new;
 end if;
 if new.status=old.status then return new;end if;
 if old.status<>'confirmed' and new.status='confirmed' then
   -- Every confirmation path, including old AdminOS controls, must convert
   -- its hold and consume exactly one real bed.
   update public.resmap_room_holds set status='converted',updated_at=now()
     where id=new.room_hold_id and status='active';
   if not found then raise exception 'Active hold disappeared before confirmation';end if;
   update public.resmap_rooms set available_beds=available_beds-1,status=case when available_beds=1 then 'full' else status end,updated_at=now()
     where id=new.room_id and inventory_kind='physical_room' and available_beds>0;
   if not found then raise exception 'Verified bed capacity unavailable';end if;
 end if;
 if old.status='confirmed' and new.status<>'confirmed' and old.room_id is not null then
    update public.resmap_rooms
       set available_beds=least(capacity,available_beds+1),status=case when status='full' then 'limited' else status end,updated_at=now()
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



drop trigger if exists rk_release_room_when_reservation_changes on public.accommodation_reservations;
create trigger rk_release_room_when_reservation_changes
after insert or update of status on public.accommodation_reservations
for each row execute function reskonnect_internal.release_changed_reservation();

create or replace function reskonnect_internal.guard_live_room_deletion()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if old.status in ('confirmed','provisional_hold') then
  raise exception 'Cancel the room reservation or release its hold before deleting the record';
 end if;
 return old;
end;
$fn$;
revoke all on function reskonnect_internal.guard_live_room_deletion() from public,anon,authenticated;
create trigger aa_rk_guard_live_room_deletion before delete on public.accommodation_reservations
for each row execute function reskonnect_internal.guard_live_room_deletion();

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
 set status='reserved',room_id=null,room_hold_id=null,updated_at=now()
 where id=r.id;
 return jsonb_build_object('status','reserved','released',true);
end;
$fn$;

create or replace function public.reskonnect_record_case_action(
 p_kind text,p_id uuid,p_action text,p_channel text default null,
 p_note text default null,p_followup_at timestamptz default null,
 p_confirm_sent boolean default false
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare item public.reskonnect_case_work_items%rowtype;
  followup_window integer:=48;
begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501';end if;
 select * into item from public.reskonnect_case_work_items
 where source_kind=p_kind and source_id=p_id for update;
 if not found then raise exception 'Service case not found';end if;
 if not (public.is_platform_staff() or public.is_authorized_residence_user(item.residence_id)) then
    raise exception 'You cannot act on this residence' using errcode='42501';
 end if;
 if p_action not in ('contact_confirmed','followup_scheduled','internal_note') then raise exception 'Invalid action';end if;
 if length(coalesce(p_note,''))>1200 then raise exception 'Note too long';end if;
 if p_action='contact_confirmed' and (not p_confirm_sent or p_channel not in ('whatsapp','email','phone','in_person')) then
   raise exception 'Only record contact that was actually sent or completed';end if;
 if p_action='followup_scheduled' and (p_followup_at is null or p_followup_at<=now() or p_followup_at>now()+interval '180 days')
   then raise exception 'Select a future follow-up date'; end if;
 insert into public.reskonnect_case_interactions
 (source_kind,source_id,actor_user_id,action,channel,note,metadata)
 values(p_kind,p_id,auth.uid(),p_action,p_channel,nullif(trim(coalesce(p_note,'')),''),
   jsonb_build_object('manual_attestation',p_action='contact_confirmed' and p_confirm_sent));
 if p_action='contact_confirmed' then
  select followup_hours into followup_window from public.reskonnect_residence_service_targets where residence_id=item.residence_id;
  followup_window:=coalesce(followup_window,48);
  update public.reskonnect_case_work_items set last_responded_at=now(),last_responded_channel=p_channel,
      followup_due_at=coalesce(p_followup_at,now()+make_interval(hours=>followup_window)),updated_at=now()
  where source_kind=p_kind and source_id=p_id;
 elsif p_action='followup_scheduled' then
  update public.reskonnect_case_work_items set followup_due_at=p_followup_at,updated_at=now()
  where source_kind=p_kind and source_id=p_id;
 end if;
 insert into public.reskonnect_service_events(residence_id,entity_type,entity_id,action,actor_user_id,metadata)
 values(item.residence_id,'case_interaction',p_id,p_action,auth.uid(),jsonb_build_object('kind',p_kind,'channel',p_channel));
 return jsonb_build_object('ok',true,'source_kind',p_kind,'source_id',p_id);
end;
$fn$;

create or replace function reskonnect_internal.expire_room_holds()
returns integer language plpgsql security definer set search_path=''
as $fn$
declare item record; n integer:=0;
begin
 for item in
  select r.id,r.room_hold_id,r.room_id from public.accommodation_reservations r
  join public.resmap_room_holds h on h.id=r.room_hold_id
  where r.status='provisional_hold' and h.status='active' and h.expires_at<=now()
  order by r.id for update of r skip locked
 loop
  update public.resmap_room_holds set status='expired',updated_at=now()
    where id=item.room_hold_id and status='active' and expires_at<=now();
  if found then
    update public.accommodation_reservations
     set status='reserved',room_id=null,room_hold_id=null,updated_at=now()
     where id=item.id and status='provisional_hold';
    n:=n+1;
  end if;
 end loop;
 -- Expire orphan holds without touching case state.
 update public.resmap_room_holds set status='expired',updated_at=now()
 where status='active' and expires_at<=now();
 return n;
end;
$fn$;
revoke all on function reskonnect_internal.expire_room_holds() from public,anon,authenticated;
select cron.schedule('reskonnect-expire-room-holds','*/10 * * * *',
  'select reskonnect_internal.expire_room_holds();');

-- Index the most frequent privacy-protected finance audit lookups.
create index if not exists rk_commercial_audit_residence on public.reskonnect_commercial_audit(residence_id,created_at desc);
create index if not exists rk_invoice_created_by on public.reskonnect_commercial_invoices(created_by);
create index if not exists rk_invoice_paid_by on public.reskonnect_commercial_invoices(marked_paid_by) where marked_paid_by is not null;
create index if not exists rk_promotion_approved_by on public.reskonnect_commercial_promotions(approved_by) where approved_by is not null;
