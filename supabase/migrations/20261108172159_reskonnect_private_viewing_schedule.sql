-- Privacy-safe viewing summary: staff and student see scheduling metadata,
-- never student email, phone number or protected application documents.

create or replace function public.reskonnect_viewing_summary(p_viewing_id uuid)
returns table(viewing_status text,preferred_date date,preferred_time_window text,
              confirmed_viewing_at timestamptz)
language plpgsql stable security definer set search_path=''
as $fn$
declare v public.viewing_requests%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 select * into v from public.viewing_requests where id=p_viewing_id;
 if not found or not coalesce(auth.uid()=v.user_id or public.is_platform_staff()
         or public.is_authorized_residence_user(v.residence_id),false) then
   raise exception 'Viewing not accessible to this account' using errcode='42501';
 end if;
 return query select v.status,v.preferred_date,v.preferred_time_window,v.confirmed_viewing_at;
end;
$fn$;
revoke all on function public.reskonnect_viewing_summary(uuid) from public,anon;
grant execute on function public.reskonnect_viewing_summary(uuid) to authenticated;
comment on function public.reskonnect_viewing_summary(uuid) is 'Auth-scoped viewing schedule; no student contact/ID data.';
