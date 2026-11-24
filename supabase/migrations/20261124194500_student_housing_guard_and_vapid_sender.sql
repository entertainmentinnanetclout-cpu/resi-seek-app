-- Limit each student's current accommodation search to three distinct residences per academic year.
-- Applies to new/reactivated intakes only; historical records remain intact.
-- A reservation and subsequent application for the SAME residence share one selection slot.
create index if not exists rk_applications_student_residence_year_guard
 on public.applications(user_id,academic_year,residence_id)
 where user_id is not null and residence_id is not null;
create index if not exists rk_reservations_student_residence_year_guard
 on public.accommodation_reservations(user_id,academic_year,residence_id);

create or replace function reskonnect_internal.guard_student_accommodation_choices()
returns trigger language plpgsql security definer set search_path='' as $$
declare current_count integer;
declare target_present boolean;
begin
 if new.user_id is null or new.residence_id is null then return new; end if;
 if lower(coalesce(new.status,'')) in ('cancelled','withdrawn','rejected') then return new; end if;
 -- Leave historic active cases editable without retroactively invalidating students.
 if tg_op='UPDATE' then
  if old.user_id is not distinct from new.user_id
   and old.residence_id is not distinct from new.residence_id
   and old.academic_year is not distinct from new.academic_year
   and lower(coalesce(old.status,'')) not in ('cancelled','withdrawn','rejected')
   then return new;
  end if;
 end if;
 -- Serialize concurrent applications/reservations even when submitted in different tabs.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.user_id::text),new.academic_year);
 if tg_table_name='applications' then
   if exists (select 1 from public.applications a where a.user_id=new.user_id and a.residence_id=new.residence_id
      and a.academic_year=new.academic_year and a.id is distinct from new.id
      and lower(coalesce(a.status,'')) not in ('cancelled','withdrawn','rejected')) then
       raise exception 'You already have an active application for this residence in %. Track it on your dashboard.',new.academic_year using errcode='23505';
   end if;
 else
   if exists (select 1 from public.accommodation_reservations r where r.user_id=new.user_id and r.residence_id=new.residence_id
      and r.academic_year=new.academic_year and r.id is distinct from new.id
      and lower(coalesce(r.status,'')) not in ('cancelled','withdrawn','rejected')) then
       raise exception 'You already have an active reservation for this residence in %. Track it on your dashboard.',new.academic_year using errcode='23505';
   end if;
 end if;
 with active_choices as (
   select residence_id from public.applications
   where user_id=new.user_id and academic_year=new.academic_year and residence_id is not null
     and lower(coalesce(status,'')) not in ('cancelled','withdrawn','rejected')
   union
   select residence_id from public.accommodation_reservations
   where user_id=new.user_id and academic_year=new.academic_year and residence_id is not null
     and lower(coalesce(status,'')) not in ('cancelled','withdrawn','rejected')
 )
 select count(*),coalesce(bool_or(residence_id=new.residence_id),false)
 into current_count,target_present from active_choices;
 if not target_present and current_count >= 3 then
  raise exception 'You can apply or reserve at a maximum of three different residences per academic year. Review your existing selections on My ResKonnect.' using errcode='P0001';
 end if;
 return new;
end;$$;
revoke all on function reskonnect_internal.guard_student_accommodation_choices() from public,anon,authenticated;
drop trigger if exists rk_limit_student_applications on public.applications;
create trigger rk_limit_student_applications before insert or update of user_id,residence_id,academic_year,status
on public.applications for each row execute function reskonnect_internal.guard_student_accommodation_choices();
drop trigger if exists rk_limit_student_reservations on public.accommodation_reservations;
create trigger rk_limit_student_reservations before insert or update of user_id,residence_id,academic_year,status
on public.accommodation_reservations for each row execute function reskonnect_internal.guard_student_accommodation_choices();

-- Keep VAPID signing material in Vault, never in client assets, GitHub or the app bundle.
-- The edge sender accesses this service-role-only function at runtime.
create or replace function public.rk_web_push_vapid_pair_for_sender()
returns jsonb language sql stable security definer set search_path='' as $$
 select s.decrypted_secret::jsonb from vault.decrypted_secrets s
 where s.name='rk_push_vapid_pair_v1' limit 1
$$;
revoke all on function public.rk_web_push_vapid_pair_for_sender() from public,anon,authenticated;
grant execute on function public.rk_web_push_vapid_pair_for_sender() to service_role;
