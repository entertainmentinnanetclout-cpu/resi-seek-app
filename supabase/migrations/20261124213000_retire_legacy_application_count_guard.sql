-- Supersede the legacy unscoped application counter with the atomic
-- shared application/reservation three-residence rule from 20261124194500.
-- The old counter included prior years and cancelled applications, which could
-- incorrectly reject otherwise eligible 2027 student applications.
do $$
begin
 if not exists (
   select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
   where c.oid='public.applications'::regclass
     and t.tgname='rk_limit_student_applications' and not t.tgisinternal
 ) then
   raise exception 'Cannot retire legacy limit: the shared replacement guard is missing';
 end if;
 drop trigger if exists check_application_limit on public.applications;
end$$;
