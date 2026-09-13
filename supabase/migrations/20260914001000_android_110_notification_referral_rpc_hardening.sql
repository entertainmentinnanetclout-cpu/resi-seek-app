-- Android/web reliability follow-up: authenticated-only referral capture and
-- staff-scoped push target access without exposing service-role credentials.

create or replace function public.capture_referral_for_current_user(_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform public.capture_referral(_code, auth.uid());
end;
$$;

revoke all on function public.capture_referral_for_current_user(text) from public;
grant execute on function public.capture_referral_for_current_user(text) to authenticated;

create or replace function public.get_push_targets(p_user_ids uuid[] default null)
returns table(endpoint text, p256dh text, auth text, user_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_role := public.get_user_staff_role(auth.uid());
  if coalesce(v_role, '') not in (
    'admin','super_admin','developer','owner',
    'operations_lead','system_operator','support_agent','growth_lead'
  ) then
    raise exception 'Staff authorization required' using errcode = '42501';
  end if;

  return query
  select ps.endpoint, ps.p256dh, ps.auth, ps.user_id
  from public.push_subscriptions ps
  where p_user_ids is null
     or cardinality(p_user_ids) = 0
     or ps.user_id = any(p_user_ids);
end;
$$;

revoke all on function public.get_push_targets(uuid[]) from public;
grant execute on function public.get_push_targets(uuid[]) to authenticated;
