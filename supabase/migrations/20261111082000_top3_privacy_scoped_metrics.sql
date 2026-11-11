-- Top 3 privacy hardening: hide applicant/reservation totals and performance scores from public APIs.
-- The ranking itself remains evidence-based. AdminOS retains private counts and landlords
-- retain access to their own applications/reservations inside their authenticated portal.
-- No application, reservation, student or review records are changed.

-- Public callers receive only display positions and provenance, NEVER counts/scores.
create or replace function public.reskonnect_public_monthly_showcase_safe()
returns table(residence_id uuid, rank_position bigint, month_start date, selection_type text)
language sql stable security definer set search_path=public,pg_temp as $$
 select s.residence_id,s.rank_position,s.month_start,s.selection_type
 from public.reskonnect_public_monthly_showcase() s
 order by s.rank_position;
$$;
revoke all on function public.reskonnect_public_monthly_showcase_safe() from public,anon,authenticated;
grant execute on function public.reskonnect_public_monthly_showcase_safe() to anon,authenticated;

-- Staff-only analytical feed, with explicit authorisation even inside SECURITY DEFINER.
create or replace function public.reskonnect_admin_top3_monthly()
returns table(residence_id uuid,rank_position bigint,applications_count bigint,
 reservations_count bigint,activity_score bigint,month_start date)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if (select auth.uid()) is null or not
    coalesce(public.has_role((select auth.uid()),'admin'::public.app_role),false) then
  raise exception 'Admin access required' using errcode='42501';
 end if;
 return query
 select o.residence_id,o.rank_position,o.applications_count,o.reservations_count,
  o.activity_score,o.month_start from public.reskonnect_public_top3_monthly() o;
end;
$$;
revoke all on function public.reskonnect_admin_top3_monthly() from public,anon,authenticated;
grant execute on function public.reskonnect_admin_top3_monthly() to authenticated;

-- These older raw functions used to expose exact reservation and applicant counts to
-- anonymous users. Keep them for server-side composition but close the Data API grants.
revoke all on function public.reskonnect_public_top3_monthly() from public,anon,authenticated;
revoke all on function public.reskonnect_public_monthly_showcase() from public,anon,authenticated;

comment on function public.reskonnect_public_monthly_showcase_safe()
 is 'Public Top 3 identity/position/provenance ONLY. No reservation, application or activity quantities.';
comment on function public.reskonnect_admin_top3_monthly()
 is 'AdminOS-only monthly student-interest counts; explicit verified admin role required.';
