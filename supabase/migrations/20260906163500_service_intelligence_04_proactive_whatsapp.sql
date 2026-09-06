-- Phase 4/10: Proactive WhatsApp notifications
-- Deterministic scheduler turns high-value next-best-actions into idempotent WhatsApp events.

create table if not exists public.adminos_proactive_notification_log (
  id uuid primary key default gen_random_uuid(),
  notification_key text not null unique,
  action_id uuid references public.adminos_next_best_actions(id) on delete set null,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  user_id uuid,
  event_id uuid references public.adminos_whatsapp_site_events(id) on delete set null,
  notification_type text not null,
  status text not null default 'queued',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_adminos_proactive_log_contact on public.adminos_proactive_notification_log(contact_id,created_at desc);
alter table public.adminos_proactive_notification_log enable row level security;
drop policy if exists "AdminOS staff read proactive notifications" on public.adminos_proactive_notification_log;
create policy "AdminOS staff read proactive notifications" on public.adminos_proactive_notification_log for select to authenticated using ((select public.adminos_is_staff()));
revoke all on public.adminos_proactive_notification_log from anon;
grant select on public.adminos_proactive_notification_log to authenticated;

insert into public.adminos_whatsapp_rich_content(content_key,display_name,content_type,approval_required,purpose,config,status)
values(
  'rk_next_step_reminder','Dimpho next-step reminder','twilio/quick-reply',true,'transactional',
  jsonb_build_object(
    'body','Hi {{1}}, Dimpho from ResKonnect here. Your next step is: {{2}}. Continue here: {{3}}',
    'actions',jsonb_build_array(
      jsonb_build_object('type','QUICK_REPLY','title','Open help','id','menu:main'),
      jsonb_build_object('type','QUICK_REPLY','title','Main menu','id','menu:main')
    )
  ),'not_created'
)
on conflict (content_key) do update set display_name=excluded.display_name,content_type=excluded.content_type,approval_required=excluded.approval_required,purpose=excluded.purpose,config=excluded.config,updated_at=now();

create or replace function public.adminos_generate_proactive_notifications() returns integer
language plpgsql security definer set search_path=public as $$
declare
  rec record;
  ev_id uuid;
  phone_value text;
  notification_type text;
  generated integer := 0;
begin
  perform public.adminos_refresh_next_best_actions();
  for rec in
    select n.*,c.phone as contact_phone,p.phone as profile_phone,p.phone_number as profile_phone_number,p.full_name
    from public.adminos_next_best_actions n
    left join public.adminos_contacts c on c.id=n.contact_id
    left join public.profiles p on p.id=n.user_id
    left join public.adminos_communication_preferences pref on pref.contact_id=n.contact_id
    where n.active=true and n.completed_at is null and n.priority>=70
      and (n.expires_at is null or n.expires_at>now())
      and coalesce(pref.do_not_contact,false)=false and coalesce(pref.whatsapp_allowed,true)=true
      and not exists(select 1 from public.adminos_proactive_notification_log l where l.notification_key=concat('nba:',n.action_key))
    order by n.priority desc,n.generated_at asc
    limit 100
  loop
    phone_value := coalesce(rec.contact_phone,rec.profile_phone,rec.profile_phone_number);
    if nullif(regexp_replace(coalesce(phone_value,''),'\D','','g'),'') is null then continue; end if;
    notification_type := case rec.action_type
      when 'complete_application' then 'proactive_application_health'
      when 'improve_application' then 'proactive_application_health'
      when 'human_review' then 'proactive_application_attention'
      when 'wil_documents' then 'proactive_wil_next_step'
      when 'review_reservation' then 'proactive_reservation_next_step'
      when 'prepare_documents' then 'proactive_application_prep'
      when 'find_accommodation' then 'proactive_accommodation_next_step'
      else 'proactive_next_step' end;

    insert into public.adminos_whatsapp_site_events(event_type,source_table,source_id,user_id,contact_id,phone,payload,status,idempotency_key)
    values(notification_type,'adminos_next_best_actions',rec.id,rec.user_id,rec.contact_id,phone_value,
      jsonb_build_object('user_name',coalesce(rec.full_name,'there'),'next_step',rec.title,'rationale',rec.rationale,'action_url',rec.action_url,'action_type',rec.action_type,'priority',rec.priority,'metadata',rec.metadata),
      'pending',concat('proactive:',rec.action_key))
    on conflict (idempotency_key) do update set payload=excluded.payload,updated_at=now()
    returning id into ev_id;

    insert into public.adminos_proactive_notification_log(notification_key,action_id,contact_id,user_id,event_id,notification_type,status,metadata)
    values(concat('nba:',rec.action_key),rec.id,rec.contact_id,rec.user_id,ev_id,notification_type,'queued',jsonb_build_object('priority',rec.priority,'action_type',rec.action_type))
    on conflict (notification_key) do nothing;
    generated := generated + 1;
  end loop;
  return generated;
end; $$;
revoke all on function public.adminos_generate_proactive_notifications() from public,anon;
grant execute on function public.adminos_generate_proactive_notifications() to authenticated;

select public.adminos_generate_proactive_notifications();
do $$ begin if exists(select 1 from cron.job where jobname='adminos-proactive-whatsapp') then perform cron.unschedule('adminos-proactive-whatsapp'); end if; end $$;
select cron.schedule('adminos-proactive-whatsapp','*/5 * * * *',$job$ select public.adminos_generate_proactive_notifications(); $job$);