-- Keep residence reservation access contact-safe and make creator case updates narrowly scoped.

drop view if exists public.residence_portal_reservations_safe;
drop policy if exists "residence portal view own reservations" on public.accommodation_reservations;

create or replace function public.get_residence_portal_reservations(p_residence_id uuid, p_year integer default 2027)
returns table(
  id uuid,residence_id uuid,academic_year integer,applicant_name text,funding_type text,room_preference text,
  status text,residence_notes text,last_contacted_at timestamptz,created_at timestamptz,updated_at timestamptz
)
language plpgsql security definer set search_path='public' set row_security='off' as $$
begin
  if not (public.is_authorized_residence_user(p_residence_id) or public.can_manage_accommodation_reservations()) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  return query
  select r.id,r.residence_id,r.academic_year,r.applicant_name,r.funding_type,r.room_preference,
         r.status,r.residence_notes,r.last_contacted_at,r.created_at,r.updated_at
  from public.accommodation_reservations r
  where r.residence_id=p_residence_id and r.academic_year=p_year
  order by r.created_at desc;
end $$;
revoke all on function public.get_residence_portal_reservations(uuid,integer) from public,anon;
grant execute on function public.get_residence_portal_reservations(uuid,integer) to authenticated;

drop function if exists public.residence_portal_update_reservation(uuid,text,text);
create function public.residence_portal_update_reservation(p_reservation_id uuid,p_status text default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path='public' set row_security='off' as $$
declare v_row public.accommodation_reservations;
begin
  select * into v_row from public.accommodation_reservations where id=p_reservation_id;
  if not found then raise exception 'Reservation not found'; end if;
  if not (public.is_authorized_residence_user(v_row.residence_id) or public.can_manage_accommodation_reservations()) then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_status is not null and p_status not in ('reserved','contacted','provisional_hold','confirmed','cancelled') then raise exception 'Invalid reservation status'; end if;
  update public.accommodation_reservations set status=coalesce(p_status,status),residence_notes=coalesce(p_note,residence_notes),
    last_contacted_at=case when p_status='contacted' then now() else last_contacted_at end,updated_at=now()
  where id=p_reservation_id returning * into v_row;
  return jsonb_build_object('id',v_row.id,'residence_id',v_row.residence_id,'academic_year',v_row.academic_year,
    'applicant_name',v_row.applicant_name,'funding_type',v_row.funding_type,'room_preference',v_row.room_preference,
    'status',v_row.status,'residence_notes',v_row.residence_notes,'last_contacted_at',v_row.last_contacted_at,
    'created_at',v_row.created_at,'updated_at',v_row.updated_at);
end $$;
revoke all on function public.residence_portal_update_reservation(uuid,text,text) from public,anon;
grant execute on function public.residence_portal_update_reservation(uuid,text,text) to authenticated;

drop policy if exists "creator manages assigned assistance cases" on public.creator_assistance_cases;
drop policy if exists "creator reads assigned assistance cases" on public.creator_assistance_cases;
create policy "creator reads assigned assistance cases" on public.creator_assistance_cases for select to authenticated using (
  consent_status='granted' and exists (select 1 from public.creator_partners cp where cp.id=creator_id and cp.user_id=auth.uid() and cp.status='active')
);

create or replace function public.creator_update_assistance_case(p_case_id uuid,p_status text,p_notes text default null,p_reference text default null)
returns jsonb language plpgsql security definer set search_path='public' set row_security='off' as $$
declare v_case public.creator_assistance_cases;
begin
  select c.* into v_case from public.creator_assistance_cases c join public.creator_partners cp on cp.id=c.creator_id
  where c.id=p_case_id and cp.user_id=auth.uid() and cp.status='active' and c.consent_status='granted';
  if not found then raise exception 'Case unavailable or consent revoked' using errcode='42501'; end if;
  if p_status not in ('requested','documents_pending','ready_to_apply','in_progress','submitted','awaiting_response','completed','closed') then raise exception 'Invalid assistance status'; end if;
  update public.creator_assistance_cases set status=p_status,creator_notes=nullif(btrim(coalesce(p_notes,'')),''),
    application_reference=nullif(btrim(coalesce(p_reference,'')),''),updated_at=now(),last_activity_at=now(),
    submitted_at=case when p_status='submitted' then coalesce(submitted_at,now()) else submitted_at end
  where id=p_case_id returning * into v_case;
  return jsonb_build_object('id',v_case.id,'status',v_case.status,'creator_notes',v_case.creator_notes,
    'application_reference',v_case.application_reference,'submitted_at',v_case.submitted_at,'updated_at',v_case.updated_at);
end $$;
revoke all on function public.creator_update_assistance_case(uuid,text,text,text) from public,anon;
grant execute on function public.creator_update_assistance_case(uuid,text,text,text) to authenticated;
