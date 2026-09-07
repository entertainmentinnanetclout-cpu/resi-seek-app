-- Harden sales-conversion RPC boundaries.
-- Runtime webhook/cron uses service/owner privileges; staff-facing bulk actions receive explicit staff wrappers.

revoke all on function public.adminos_touch_whatsapp_conversion(uuid,uuid,uuid,text,text,jsonb) from authenticated;
revoke all on function public.adminos_generate_conversion_followups() from authenticated;
revoke all on function public.adminos_build_landlord_campaign_recipients(uuid) from authenticated;
revoke all on function public.adminos_queue_landlord_campaign(uuid) from authenticated;

create or replace function public.adminos_staff_build_landlord_campaign_recipients(p_campaign_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  result jsonb;
  total_count integer;
  eligible_count integer;
begin
  if not public.adminos_is_staff() then
    raise exception 'Staff access required';
  end if;

  result := public.adminos_build_landlord_campaign_recipients(p_campaign_id);

  delete from public.adminos_landlord_outreach_recipients
  where campaign_id=p_campaign_id
    and nullif(regexp_replace(coalesce(phone,''),'\D','','g'),'') is null;

  select count(*)::integer,count(*) filter (where eligible)::integer
    into total_count,eligible_count
  from public.adminos_landlord_outreach_recipients
  where campaign_id=p_campaign_id;

  update public.adminos_landlord_outreach_campaigns
  set recipient_count=coalesce(total_count,0),eligible_count=coalesce(eligible_count,0),updated_at=now()
  where id=p_campaign_id;

  return jsonb_build_object(
    'recipient_count',coalesce(total_count,0),
    'eligible_count',coalesce(eligible_count,0),
    'blocked_count',greatest(coalesce(total_count,0)-coalesce(eligible_count,0),0)
  );
end; $$;
revoke all on function public.adminos_staff_build_landlord_campaign_recipients(uuid) from public,anon;
grant execute on function public.adminos_staff_build_landlord_campaign_recipients(uuid) to authenticated;

create or replace function public.adminos_staff_queue_landlord_campaign(p_campaign_id uuid) returns integer
language plpgsql security definer set search_path=public as $$
begin
  if not public.adminos_is_staff() then
    raise exception 'Staff access required';
  end if;
  return public.adminos_queue_landlord_campaign(p_campaign_id);
end; $$;
revoke all on function public.adminos_staff_queue_landlord_campaign(uuid) from public,anon;
grant execute on function public.adminos_staff_queue_landlord_campaign(uuid) to authenticated;
