-- Phase 7/10: Service Recovery Queue
-- Deterministic watchdog for unanswered customers, failed deliveries and automation failures.

create table if not exists public.adminos_service_recovery_items (
  id uuid primary key default gen_random_uuid(),
  issue_key text not null unique,
  thread_id uuid references public.adminos_whatsapp_threads(id) on delete cascade,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  issue_type text not null,
  priority integer not null default 70 check (priority between 0 and 100),
  reason text not null,
  last_customer_message_at timestamptz,
  last_service_message_at timestamptz,
  age_seconds integer not null default 0,
  status text not null default 'open' check (status in ('open','in_progress','resolved','snoozed')),
  assigned_to uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_adminos_recovery_open_priority on public.adminos_service_recovery_items(status,priority desc,last_detected_at desc);
create index if not exists idx_adminos_recovery_thread on public.adminos_service_recovery_items(thread_id,status);
alter table public.adminos_service_recovery_items enable row level security;
drop policy if exists "AdminOS staff manage service recovery" on public.adminos_service_recovery_items;
create policy "AdminOS staff manage service recovery" on public.adminos_service_recovery_items for all to authenticated using ((select public.adminos_is_staff())) with check ((select public.adminos_is_staff()));
revoke all on public.adminos_service_recovery_items from anon;
grant select,update on public.adminos_service_recovery_items to authenticated;

insert into public.adminos_whatsapp_rich_content(content_key,display_name,content_type,approval_required,purpose,config,status)
values('rk_service_recovery','Dimpho service recovery acknowledgement','twilio/quick-reply',true,'transactional',
  jsonb_build_object('body','Hi {{1}}, Dimpho from ResKonnect here. We have your message and I noticed it has been waiting longer than expected. I have kept your context and moved it into our priority service queue.','actions',jsonb_build_array(
    jsonb_build_object('type','QUICK_REPLY','title','Continue with Dimpho','id','menu:main'),
    jsonb_build_object('type','QUICK_REPLY','title','Wait for human','id','human:wait')
  )),'not_created')
on conflict (content_key) do update set display_name=excluded.display_name,content_type=excluded.content_type,approval_required=excluded.approval_required,purpose=excluded.purpose,config=excluded.config,updated_at=now();

create or replace function public.adminos_refresh_service_recovery() returns integer
language plpgsql security definer set search_path=public as $$
declare rec record; v_age integer; v_priority integer; v_count integer;
begin
  -- Unanswered customer messages older than 5 minutes.
  for rec in
    select t.id as thread_id,t.contact_id,t.last_inbound_at,t.last_outbound_at,t.mode,t.status,c.profile_user_id,c.full_name,c.phone
    from public.adminos_whatsapp_threads t left join public.adminos_contacts c on c.id=t.contact_id
    where t.last_inbound_at is not null
      and t.last_inbound_at > coalesce(t.last_outbound_at,'epoch'::timestamptz)
      and t.last_inbound_at < now()-interval '5 minutes'
      and coalesce(t.status,'open') not in ('resolved','closed')
  loop
    v_age:=greatest(0,extract(epoch from (now()-rec.last_inbound_at))::integer);
    v_priority:=case when v_age>=3600 then 100 when v_age>=1800 then 95 when v_age>=900 then 90 else 80 end;
    insert into public.adminos_service_recovery_items(issue_key,thread_id,contact_id,issue_type,priority,reason,last_customer_message_at,last_service_message_at,age_seconds,status,metadata,last_detected_at)
    values(concat('thread:',rec.thread_id,':unanswered'),rec.thread_id,rec.contact_id,'unanswered_customer',v_priority,
      'Customer sent the latest message and no service response followed within the service target.',rec.last_inbound_at,rec.last_outbound_at,v_age,'open',
      jsonb_build_object('mode',rec.mode,'thread_status',rec.status,'profile_user_id',rec.profile_user_id,'contact_name',rec.full_name),now())
    on conflict (issue_key) do update set priority=excluded.priority,age_seconds=excluded.age_seconds,last_detected_at=now(),reason=excluded.reason,metadata=excluded.metadata,status=case when adminos_service_recovery_items.status='resolved' and excluded.last_customer_message_at>coalesce(adminos_service_recovery_items.resolved_at,'epoch'::timestamptz) then 'open' else adminos_service_recovery_items.status end,last_customer_message_at=excluded.last_customer_message_at,last_service_message_at=excluded.last_service_message_at;
  end loop;

  -- Failed WhatsApp deliveries.
  insert into public.adminos_service_recovery_items(issue_key,thread_id,contact_id,issue_type,priority,reason,last_customer_message_at,last_service_message_at,age_seconds,status,metadata,last_detected_at)
  select concat('message:',m.id,':delivery'),m.thread_id,m.contact_id,'delivery_failure',95,
    concat('Outbound WhatsApp message ended with status ',m.status,'.'),t.last_inbound_at,t.last_outbound_at,
    greatest(0,extract(epoch from (now()-m.created_at))::integer),'open',jsonb_build_object('message_id',m.id,'twilio_message_sid',m.twilio_message_sid,'status',m.status),now()
  from public.adminos_whatsapp_messages m join public.adminos_whatsapp_threads t on t.id=m.thread_id
  where m.direction='outbound' and m.status in ('failed','undelivered') and m.created_at>=now()-interval '7 days'
  on conflict (issue_key) do update set priority=excluded.priority,last_detected_at=now(),metadata=excluded.metadata;

  -- Automation/site-event failures that can strand a customer journey.
  insert into public.adminos_service_recovery_items(issue_key,thread_id,contact_id,issue_type,priority,reason,last_customer_message_at,last_service_message_at,age_seconds,status,metadata,last_detected_at)
  select concat('site-event:',e.id),t.id,e.contact_id,'automation_failure',
    case when e.status='blocked' then 95 when e.status='failed' then 90 else 75 end,
    concat('WhatsApp automation event ',e.event_type,' is ',e.status,'.'),t.last_inbound_at,t.last_outbound_at,
    greatest(0,extract(epoch from (now()-e.created_at))::integer),'open',jsonb_build_object('site_event_id',e.id,'event_type',e.event_type,'status',e.status,'last_error',e.last_error),now()
  from public.adminos_whatsapp_site_events e left join public.adminos_whatsapp_threads t on t.contact_id=e.contact_id
  where e.status in ('failed','blocked','waiting_template') and e.created_at<now()-interval '20 minutes' and e.created_at>=now()-interval '7 days'
  on conflict (issue_key) do update set priority=excluded.priority,last_detected_at=now(),metadata=excluded.metadata,reason=excluded.reason;

  -- Auto-resolve stale unanswered issues once a later service reply exists.
  update public.adminos_service_recovery_items i set status='resolved',resolved_at=now(),resolved_by=null,last_detected_at=now()
  from public.adminos_whatsapp_threads t
  where i.thread_id=t.id and i.issue_type='unanswered_customer' and i.status in ('open','in_progress')
    and t.last_outbound_at is not null and t.last_outbound_at>=i.last_customer_message_at;

  -- Send one acknowledgement for unanswered cases older than 10 minutes; worker enforces opt-out/template rules.
  insert into public.adminos_whatsapp_site_events(event_type,source_table,source_id,user_id,contact_id,phone,payload,status,idempotency_key)
  select 'service_recovery_ack','adminos_service_recovery_items',i.id,c.profile_user_id,i.contact_id,c.phone,
    jsonb_build_object('user_name',coalesce(c.full_name,'there'),'recovery_id',i.id,'reason',i.reason,'priority',i.priority),
    'pending',concat('service-recovery:',i.id)
  from public.adminos_service_recovery_items i join public.adminos_contacts c on c.id=i.contact_id
  where i.issue_type='unanswered_customer' and i.status='open' and i.age_seconds>=600 and nullif(c.phone,'') is not null
  on conflict (idempotency_key) do nothing;

  select count(*)::integer into v_count from public.adminos_service_recovery_items where status in ('open','in_progress');
  return v_count;
end; $$;
revoke all on function public.adminos_refresh_service_recovery() from public,anon;
grant execute on function public.adminos_refresh_service_recovery() to authenticated;

create or replace function public.adminos_resolve_service_recovery(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.adminos_is_staff() then raise exception 'Staff access required'; end if;
  update public.adminos_service_recovery_items set status='resolved',resolved_at=now(),resolved_by=auth.uid(),last_detected_at=now() where id=p_id;
end; $$;
revoke all on function public.adminos_resolve_service_recovery(uuid) from public,anon;
grant execute on function public.adminos_resolve_service_recovery(uuid) to authenticated;

select public.adminos_refresh_service_recovery();
do $$ begin if exists(select 1 from cron.job where jobname='adminos-service-recovery-watch') then perform cron.unschedule('adminos-service-recovery-watch'); end if; end $$;
select cron.schedule('adminos-service-recovery-watch','* * * * *',$job$ select public.adminos_refresh_service_recovery(); $job$);