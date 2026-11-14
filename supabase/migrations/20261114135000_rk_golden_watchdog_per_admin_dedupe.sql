-- Fix a real service watchdog failure: notifications.event_key is globally unique.
-- Two admin recipients previously shared one daily key, rolling back every 15-minute tick.
-- Keep existing per-admin daily digest receipts AND make the notification key per recipient.
CREATE OR REPLACE FUNCTION reskonnect_internal.rk_golden_service_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_breaches integer:=0;v_overdue integer:=0;v_unanswered integer:=0;u record;v_sent uuid;
begin
 update public.rk_golden_service_cases c set first_breach_at=now(),updated_at=now()
 where c.closed_at is null and c.first_breach_at is null
  and (c.snoozed_until is null or c.snoozed_until<=now())
  and ((c.last_human_response_at is null and c.first_response_due_at<now())
   or c.next_action_due_at<now());
 get diagnostics v_breaches=row_count;
 select count(*),count(*) filter(where last_human_response_at is null)
 into v_overdue,v_unanswered from public.rk_golden_service_cases
 where closed_at is null and (snoozed_until is null or snoozed_until<=now())
   and ((last_human_response_at is null and first_response_due_at<now()) or next_action_due_at<now());
 if v_overdue>0 then
  for u in select distinct user_id from public.user_roles where role='admin' loop
   insert into public.rk_golden_digest_receipts(admin_user_id,digest_day)
   values(u.user_id,(now() at time zone 'Africa/Johannesburg')::date)
   on conflict do nothing returning admin_user_id into v_sent;
   if v_sent is not null then
    insert into public.notifications(user_id,type,title,message,metadata,is_read,event_key)
    values(u.user_id,'golden_service_watch','ResKonnect service actions need attention',
     v_overdue::text||' requests require an operator action; '||v_unanswered::text||
     ' have no confirmed human response. Open Golden Service Cycle.',
     jsonb_build_object('route','/admin/golden-cycle','overdue',v_overdue,'unanswered',v_unanswered),
     false,'rk_golden_watch_'||(now() at time zone 'Africa/Johannesburg')::date::text||'_'||u.user_id::text)
    on conflict (event_key) do nothing;
   end if;
   v_sent:=null;
  end loop;
 end if;
 return v_breaches;
end $function$;

comment on function reskonnect_internal.rk_golden_service_tick() is
 'Every 15 minutes records service breaches and creates at most one internal daily digest per authorised admin; per-admin event keys avoid global notifications uniqueness collisions.';
