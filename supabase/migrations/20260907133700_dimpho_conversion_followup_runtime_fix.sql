-- Ensure conversion follow-ups can resolve a WhatsApp number even when the contact record has no phone copy.
create or replace function public.adminos_generate_conversion_followups() returns integer
language plpgsql security definer set search_path=public as $$
declare
  rec record;
  ev_id uuid;
  event_kind text;
  action_url text;
  generated integer := 0;
begin
  for rec in
    select l.*,c.full_name,c.phone,t.customer_window_expires_at,t.channel_address,
           coalesce(pref.do_not_contact,false) as dnc,
           coalesce(pref.whatsapp_allowed,true) as wa_allowed,
           coalesce(pref.marketing_allowed,false) as marketing_allowed,
           r.slug as residence_slug,r.name as residence_name
    from public.adminos_whatsapp_conversion_leads l
    join public.adminos_whatsapp_threads t on t.id=l.thread_id
    left join public.adminos_contacts c on c.id=l.contact_id
    left join public.adminos_communication_preferences pref on pref.contact_id=l.contact_id
    left join public.residences r on r.id=l.selected_residence_id
    where l.converted_at is null and l.closed_at is null
      and l.follow_up_count < 3
      and l.next_follow_up_at is not null and l.next_follow_up_at <= now()
      and coalesce(pref.do_not_contact,false)=false
      and coalesce(pref.whatsapp_allowed,true)=true
      and nullif(regexp_replace(coalesce(c.phone,t.channel_address,''),'\D','','g'),'') is not null
    order by l.next_follow_up_at asc
    limit 100
  loop
    if rec.customer_window_expires_at is not null and rec.customer_window_expires_at > now() then
      event_kind := 'conversion_followup_service';
    elsif rec.stage in ('application_started','reservation_started','lead_created') then
      event_kind := 'conversion_followup_action';
    elsif rec.marketing_allowed then
      event_kind := 'conversion_followup_interest';
    else
      update public.adminos_whatsapp_conversion_leads
      set next_follow_up_at=null,metadata=metadata||jsonb_build_object('followup_paused_reason','marketing_permission_required'),updated_at=now()
      where id=rec.id;
      continue;
    end if;

    action_url := case
      when rec.selected_residence_id is not null then 'https://www.reskonnect.org/find-my-res/'||coalesce(rec.residence_slug,rec.selected_residence_id::text)
      when rec.intent='accommodation' then 'https://www.reskonnect.org/findmyres'
      when rec.intent in ('applications','enrollment','nsfas') then 'https://www.reskonnect.org/applications'
      when rec.intent='wil' then 'https://www.reskonnect.org/opportunities'
      else 'https://www.reskonnect.org'
    end;

    insert into public.adminos_whatsapp_site_events(event_type,source_table,source_id,user_id,contact_id,phone,payload,status,idempotency_key)
    values(
      event_kind,'adminos_whatsapp_conversion_leads',rec.id,rec.user_id,rec.contact_id,coalesce(rec.phone,rec.channel_address),
      jsonb_build_object(
        'user_name',coalesce(rec.full_name,'there'),'intent',rec.intent,'stage',rec.stage,'campus',rec.campus,
        'residence_name',rec.residence_name,'action_url',action_url,'follow_up_number',rec.follow_up_count+1
      ),'pending',concat('conversion-followup:',rec.id,':',rec.follow_up_count+1)
    ) on conflict (idempotency_key) do update set payload=excluded.payload,updated_at=now()
    returning id into ev_id;

    update public.adminos_whatsapp_conversion_leads
    set follow_up_count=follow_up_count+1,
        next_follow_up_at=case follow_up_count+1 when 1 then now()+interval '12 hours' when 2 then now()+interval '48 hours' else null end,
        metadata=metadata||jsonb_build_object('last_followup_event_id',ev_id,'last_followup_type',event_kind),updated_at=now()
    where id=rec.id;
    generated := generated + 1;
  end loop;
  return generated;
end; $$;
revoke all on function public.adminos_generate_conversion_followups() from public,anon,authenticated;
