-- Prevent bypass of closed admissions through reassignment/reclassification of a past application.
-- Updates that keep the same residence and year (statuses, notes, document workflows,
-- academic cycles) are unaffected.
create or replace function public.enforce_residence_application_intake()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare v_open boolean;
begin
 if tg_op='UPDATE' and new.residence_id is not distinct from old.residence_id
    and new.academic_year is not distinct from old.academic_year then
   return new;
 end if;

 select true into v_open
 from public.residence_application_intake rule
 join public.residences r on r.id=rule.residence_id
 where rule.residence_id=new.residence_id
   and rule.academic_year=new.academic_year
   and rule.is_open=true
   and current_date between rule.opens_on and rule.closes_on
   and (not rule.private_only or lower(coalesce(new.funding_type,''))='private')
   and (not rule.private_only or r.accepts_private=true)
 limit 1;
 if coalesce(v_open,false) is not true then
   raise exception 'Accommodation applications are currently closed. Please reserve for 2027 where available.'
   using errcode='P0001';
 end if;
 return new;
end;
$function$;
revoke all on function public.enforce_residence_application_intake() from public,anon,authenticated;
drop trigger if exists trg_reskonnect_enforce_application_intake on public.applications;
create trigger trg_reskonnect_enforce_application_intake
 before insert or update of academic_year,residence_id on public.applications
 for each row execute function public.enforce_residence_application_intake();
