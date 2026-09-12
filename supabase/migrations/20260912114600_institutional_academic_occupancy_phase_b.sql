-- Institutional academic occupancy Phase B.
-- Apply only after every accommodation reservation writer uses the
-- five-column academic-period conflict target.

alter table public.accommodation_reservations
  drop constraint if exists accommodation_reservations_user_id_residence_id_academic_ye_key;

create or replace function public.resmap_hold_room(
  p_room_id uuid,
  p_academic_year integer default 2027,
  p_funding_type text default 'undecided'::text
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid();
  room_row public.resmap_rooms%rowtype;
  active_holds integer;
  hold_id uuid;
  reservation_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_academic_year<2020 or p_academic_year>2100 then raise exception 'Invalid academic year'; end if;
  if p_funding_type not in ('private','nsfas','other','undecided') then p_funding_type:='undecided'; end if;

  update public.resmap_room_holds
  set status='expired',updated_at=now()
  where status='active' and expires_at<=now();

  select * into room_row
  from public.resmap_rooms
  where id=p_room_id and is_published=true
  for update;

  if not found then raise exception 'Room inventory not found'; end if;
  if not room_row.reservable then raise exception 'This room inventory is not open for direct reservation yet'; end if;
  if room_row.available_beds<=0 or room_row.status in ('full','offline') then raise exception 'No spaces are currently available'; end if;

  select count(*) into active_holds
  from public.resmap_room_holds
  where room_id=p_room_id and status='active' and expires_at>now();

  if active_holds>=room_row.available_beds then
    raise exception 'All currently available spaces are being held';
  end if;

  insert into public.resmap_room_holds(user_id,residence_id,room_id,academic_year,status,expires_at)
  values(uid,room_row.residence_id,p_room_id,p_academic_year,'active',now()+interval '20 minutes')
  on conflict(user_id,room_id,academic_year) where status='active'
  do update set expires_at=now()+interval '20 minutes',updated_at=now()
  returning id into hold_id;

  insert into public.accommodation_reservations(
    user_id,residence_id,academic_year,academic_cycle,academic_period,
    funding_type,room_preference,status,source,room_id,room_hold_id
  )
  values(
    uid,room_row.residence_id,p_academic_year,'unspecified',0,
    p_funding_type,coalesce(room_row.room_code,room_row.name),
    'provisional_hold','resmap_room_select',p_room_id,hold_id
  )
  on conflict(user_id,residence_id,academic_year,academic_cycle,academic_period)
  do update set
    funding_type=excluded.funding_type,
    room_preference=excluded.room_preference,
    status='provisional_hold',
    source='resmap_room_select',
    room_id=excluded.room_id,
    room_hold_id=excluded.room_hold_id,
    updated_at=now()
  returning id into reservation_id;

  return jsonb_build_object(
    'ok',true,'hold_id',hold_id,'reservation_id',reservation_id,
    'academic_year',p_academic_year,'academic_cycle','unspecified','academic_period',0,
    'expires_at',now()+interval '20 minutes','room',room_row.name
  );
end $$;

comment on function public.resmap_hold_room(uuid,integer,text) is
'Creates a temporary room hold and an academic-period-aware accommodation reservation. The legacy RPC signature is preserved for client compatibility.';
