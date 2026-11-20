-- Residence communications ledger and sender-aware Gmail limits.
-- Service-role only. The app sends individual, reviewed Gmail/PDF messages.
create table if not exists public.reskonnect_gmail_sender_policies (
 sender_email text primary key,
 tier text not null default 'standard' check (tier in ('standard','workspace_verified')),
 verified_by uuid,
 verified_at timestamptz,
 updated_at timestamptz not null default now(),
 blocked_until timestamptz
);
alter table public.reskonnect_gmail_sender_policies enable row level security;
revoke all on public.reskonnect_gmail_sender_policies from public,anon,authenticated;
grant select,insert,update on public.reskonnect_gmail_sender_policies to service_role;
create index if not exists rk_gmail_sender_rolling_idx
 on public.reskonnect_outbound_emails
 ((lower(context_snapshot->>'sender_email')),created_at desc)
 where delivery_status in ('sending','sent','unknown');

create or replace function public.rk_gmail_sender_budget(p_sender text)
returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare
 v_sender text:=lower(btrim(coalesce(p_sender,'')));
 v_policy public.reskonnect_gmail_sender_policies%rowtype;
 v_limit integer;
 v_used bigint;
begin
 if length(v_sender)<6 or length(v_sender)>320 or position('@' in v_sender)<2 then
  raise exception 'Valid connected Gmail sender is required';
 end if;
 select * into v_policy from public.reskonnect_gmail_sender_policies where sender_email=v_sender;
 v_limit:=case when v_policy.tier='workspace_verified' then 1800 else 450 end;
 select count(*) into v_used from public.reskonnect_outbound_emails m
 where lower(m.context_snapshot->>'sender_email')=v_sender
 and m.created_at>=now()-interval '24 hours'
 and m.delivery_status in ('sending','sent','unknown');
 return jsonb_build_object('tier',coalesce(v_policy.tier,'standard'),'limit',v_limit,
  'used',v_used,'remaining',greatest(0,v_limit-v_used),
  'blocked_until',v_policy.blocked_until,
  'count_scope','ResKonnect audited sends only; other Gmail activity is not included');
end
$fn$;
revoke all on function public.rk_gmail_sender_budget(text) from public,anon,authenticated;
grant execute on function public.rk_gmail_sender_budget(text) to service_role;

-- Atomic per-sender reservation blocks concurrent operators from exceeding
-- the ResKonnect ceiling. Idempotency is already reconciled in the Edge handler.
create or replace function public.rk_gmail_reserve_send(
 p_sender text,p_actor uuid,p_kind text,p_target uuid,p_template text,
 p_request uuid,p_recipient text,p_recipient_user uuid,p_subject text,
 p_batch uuid,p_snapshot jsonb
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare
 v_sender text:=lower(btrim(coalesce(p_sender,'')));
 v_policy public.reskonnect_gmail_sender_policies%rowtype;
 v_limit integer;
 v_used bigint;
 v_id uuid;
begin
 if length(v_sender)<6 or length(v_sender)>320 or position('@' in v_sender)<2
    or p_actor is null or p_target is null or p_request is null
    or p_kind not in ('application','reservation','housing_lead','support_enquiry') then
  return jsonb_build_object('reserved',false,'reason','invalid_send_request');
 end if;
 if not exists(
  select 1 from public.landlord_gmail_connections g
  where g.user_id=p_actor and g.enabled and lower(g.gmail_address)=v_sender
 ) then
  return jsonb_build_object('reserved',false,'reason','sender_not_connected');
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_sender,20261120));
 select * into v_policy from public.reskonnect_gmail_sender_policies where sender_email=v_sender;
 if v_policy.blocked_until>now() then
  return jsonb_build_object('reserved',false,'reason','gmail_temporarily_limited','blocked_until',v_policy.blocked_until);
 end if;
 v_limit:=case when v_policy.tier='workspace_verified' then 1800 else 450 end;
 select count(*) into v_used from public.reskonnect_outbound_emails m
 where lower(m.context_snapshot->>'sender_email')=v_sender
   and m.created_at>=now()-interval '24 hours'
   and m.delivery_status in ('sending','sent','unknown');
 if v_used>=v_limit then
  return jsonb_build_object('reserved',false,'reason','reskonnect_rolling_ceiling',
   'limit',v_limit,'used',v_used);
 end if;
 insert into public.reskonnect_outbound_emails(
  actor_user_id,target_kind,target_id,template_key,idempotency_key,
  recipient_email,recipient_user_id,subject,delivery_status,batch_id,pdf_attached,context_snapshot)
 values(p_actor,p_kind,p_target,p_template,p_request,p_recipient,p_recipient_user,
  p_subject,'sending',p_batch,false,
  jsonb_set(coalesce(p_snapshot,'{}'::jsonb),'{sender_email}',to_jsonb(v_sender),true))
 returning id into v_id;
 return jsonb_build_object('reserved',true,'id',v_id,'limit',v_limit,
  'used',v_used+1,'remaining',greatest(0,v_limit-v_used-1));
exception when unique_violation then
 return jsonb_build_object('reserved',false,'reason','duplicate_request_id');
end
$fn$;
revoke all on function public.rk_gmail_reserve_send(text,uuid,text,uuid,text,uuid,text,uuid,text,uuid,jsonb)
 from public,anon,authenticated;
grant execute on function public.rk_gmail_reserve_send(text,uuid,text,uuid,text,uuid,text,uuid,text,uuid,jsonb) to service_role;

-- A provider throttle pauses this sender, not every ResKonnect mailbox.
create or replace function public.rk_gmail_sender_pause(p_sender text,p_minutes integer)
returns void language plpgsql security invoker set search_path=''
as $fn$
begin
 if p_minutes between 1 and 1440 then
  insert into public.reskonnect_gmail_sender_policies(sender_email,blocked_until)
  values(lower(btrim(p_sender)),now()+make_interval(mins=>p_minutes))
  on conflict(sender_email) do update
  set blocked_until=greatest(
    coalesce(public.reskonnect_gmail_sender_policies.blocked_until,now()),
    excluded.blocked_until),updated_at=now();
 end if;
end
$fn$;
revoke all on function public.rk_gmail_sender_pause(text,integer) from public,anon,authenticated;
grant execute on function public.rk_gmail_sender_pause(text,integer) to service_role;

-- Read-only case-level cross-channel evidence. Opened WhatsApp != sent;
-- operator_marked_sent != delivered/read. No recipient contact details exposed.
create or replace function public.rk_residence_case_channel_snapshot(p_kind text,p_ids uuid[])
returns jsonb language sql stable security invoker set search_path=''
as $fn$
 with targets as (
  select distinct id from unnest(p_ids) id
  where id is not null limit 100
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',t.id,
  'whatsapp_marked_sent',exists(
   select 1 from public.reskonnect_whatsapp_handoffs w
   where w.target_kind=p_kind and w.target_id=t.id and w.status='operator_marked_sent'),
  'whatsapp_opened',exists(
   select 1 from public.reskonnect_whatsapp_handoffs w
   where w.target_kind=p_kind and w.target_id=t.id and w.status='opened'),
  'last_whatsapp_at',(select max(w.marked_sent_at) from public.reskonnect_whatsapp_handoffs w
   where w.target_kind=p_kind and w.target_id=t.id and w.status='operator_marked_sent'),
  'last_whatsapp_status',(select w.status from public.reskonnect_whatsapp_handoffs w
   where w.target_kind=p_kind and w.target_id=t.id
   order by w.created_at desc limit 1),
  'last_whatsapp_recorded_status',(select w.recorded_case_status from public.reskonnect_whatsapp_handoffs w
   where w.target_kind=p_kind and w.target_id=t.id and w.status='operator_marked_sent'
   order by w.marked_sent_at desc nulls last limit 1),
  'last_sync_old_status',(select a.old_status from public.reskonnect_email_status_sync_audit a
   where a.target_kind=p_kind and a.target_id=t.id and a.applied
   order by a.created_at desc limit 1),
  'last_sync_new_status',(select a.new_status from public.reskonnect_email_status_sync_audit a
   where a.target_kind=p_kind and a.target_id=t.id and a.applied
   order by a.created_at desc limit 1),
  'last_sync_at',(select a.created_at from public.reskonnect_email_status_sync_audit a
   where a.target_kind=p_kind and a.target_id=t.id and a.applied
   order by a.created_at desc limit 1)
 )),'[]'::jsonb) from targets t;
$fn$;
revoke all on function public.rk_residence_case_channel_snapshot(text,uuid[]) from public,anon,authenticated;
grant execute on function public.rk_residence_case_channel_snapshot(text,uuid[]) to service_role;
create index if not exists rk_whatsapp_case_channel_idx
 on public.reskonnect_whatsapp_handoffs(target_kind,target_id,created_at desc);
create index if not exists rk_email_sync_channel_idx
 on public.reskonnect_email_status_sync_audit(target_kind,target_id,created_at desc)
 where applied;
