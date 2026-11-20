-- Accurate case-level delivery reconciliation and conservative post-Gmail status synchronization.
-- No historical emails are replayed and no external messages are triggered here.
create table if not exists public.reskonnect_email_status_sync_audit (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null unique references public.reskonnect_outbound_emails(id) on delete restrict,
  actor_user_id uuid not null,
  target_kind text not null check (target_kind in ('application','reservation')),
  target_id uuid not null,
  template_key text not null,
  old_status text,
  new_status text,
  applied boolean not null default false,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.reskonnect_email_status_sync_audit enable row level security;
revoke all on public.reskonnect_email_status_sync_audit from public,anon,authenticated;
grant select,insert on public.reskonnect_email_status_sync_audit to service_role;
create index if not exists rk_email_sync_case_idx on public.reskonnect_email_status_sync_audit(target_kind,target_id,created_at desc);

-- Narrow, independently testable status mapper. Never produces approval,
-- rejection, confirmation, cancellation, or a physical-room hold.
create or replace function reskonnect_internal.rk_email_nonfinal_status(
 p_kind text,p_current text,p_template text,p_review_stage text,p_document_stage text
) returns text
language sql immutable security invoker set search_path=''
as $fn$
 select case
  when p_kind='reservation' and p_current='reserved'
    and p_template in ('triage_received','triage_under_review','acknowledgement','documents_needed',
       'documents_received','follow_up','status_update','feedback','next_steps')
    then 'contacted'
  when p_kind='application' and p_current='submitted'
    and p_template='triage_under_review' and p_review_stage='under_review'
    then 'under_review'
  when p_kind='application' and p_current in ('submitted','under_review')
    and p_template='documents_needed' and p_document_stage in ('missing','incomplete')
    then 'documents_required'
  else p_current
 end
$fn$;
revoke all on function reskonnect_internal.rk_email_nonfinal_status(text,text,text,text,text) from public,anon,authenticated;
grant execute on function reskonnect_internal.rk_email_nonfinal_status(text,text,text,text,text) to service_role;

-- Called only after Gmail returns HTTP 2xx and a provider message ID is recorded.
-- The email audit and the source-case status are locked; stale/manual changes win.
-- Each confirmed email is reconciled at most once, with a durable audit.
create or replace function public.rk_email_sync_after_send(p_email_id uuid)
returns jsonb
language plpgsql security invoker set search_path=''
as $fn$
declare
 v_mail public.reskonnect_outbound_emails%rowtype;
 v_previous jsonb;
 v_current text;
 v_new text;
 v_stage text;
 v_reason text := 'no_status_change_needed';
 v_applied boolean := false;
 v_id uuid;
begin
 select * into v_mail from public.reskonnect_outbound_emails
 where id=p_email_id for update;
 if not found then return jsonb_build_object('applied',false,'reason','email_not_found');end if;
 if v_mail.delivery_status <> 'sent' or v_mail.provider_message_id is null or v_mail.sent_at is null then
  return jsonb_build_object('applied',false,'reason','provider_delivery_unverified');
 end if;
 select to_jsonb(a) into v_previous
 from public.reskonnect_email_status_sync_audit a where a.email_id=p_email_id;
 if v_previous is not null then
  return jsonb_build_object('applied',coalesce((v_previous->>'applied')::boolean,false),
    'reason',v_previous->>'reason','old_status',v_previous->>'old_status',
    'new_status',v_previous->>'new_status','recovered',true);
 end if;
 if v_mail.target_kind not in ('reservation','application')
   or v_mail.context_snapshot->>'sender_scope' is distinct from 'reskonnect'
   or not exists(select 1 from public.user_roles r where r.user_id=v_mail.actor_user_id and r.role='admin') then
  return jsonb_build_object('applied',false,'reason','only_verified_official_case_mail_updates_status');
 end if;
 if v_mail.target_kind='reservation' then
  select status into v_current from public.accommodation_reservations
  where id=v_mail.target_id for update;
 else
  select status into v_current from public.applications
  where id=v_mail.target_id for update;
 end if;
 if not found then return jsonb_build_object('applied',false,'reason','case_no_longer_exists');end if;
 if v_current is distinct from v_mail.context_snapshot->>'recorded_status' then
  v_new:=v_current;v_reason:='case_status_changed_since_email_preview';
 else
  select stage into v_stage from public.rk_case_workflows
    where kind=v_mail.target_kind and case_id=v_mail.target_id;
  v_new:=reskonnect_internal.rk_email_nonfinal_status(
   v_mail.target_kind,v_current,v_mail.template_key,v_stage,
   v_mail.context_snapshot->>'document_stage');
  if v_new is distinct from v_current then
   if v_mail.target_kind='reservation' then
    update public.accommodation_reservations
     set status=v_new,last_contacted_at=v_mail.sent_at
    where id=v_mail.target_id and status=v_current;
   else
    update public.applications set status=v_new
    where id=v_mail.target_id and status=v_current;
   end if;
   if found then v_reason:='verified_correspondence_nonfinal_progression';v_applied:=true;
   else v_reason:='case_changed_before_status_update';v_new:=v_current;end if;
  end if;
 end if;
 insert into public.reskonnect_email_status_sync_audit(
  email_id,actor_user_id,target_kind,target_id,template_key,old_status,new_status,applied,reason)
 values(p_email_id,v_mail.actor_user_id,v_mail.target_kind,v_mail.target_id,
  v_mail.template_key,v_current,v_new,v_applied,v_reason)
 returning id into v_id;
 return jsonb_build_object('applied',v_applied,'reason',v_reason,
   'old_status',v_current,'new_status',v_new,'audit_id',v_id);
end
$fn$;
revoke all on function public.rk_email_sync_after_send(uuid) from public,anon,authenticated;
grant execute on function public.rk_email_sync_after_send(uuid) to service_role;

-- Case counts use EXACT, mutually exclusive partitions, not template totals,
-- selected checkbox counts, or 100-row/100-email paginated browser views.
create or replace function public.rk_email_delivery_coverage(
 p_kind text,p_residence_id uuid,p_year integer default null
) returns jsonb
language sql stable security invoker set search_path=''
as $fn$
with cases as (
 select id,status,created_at from public.accommodation_reservations
 where p_kind='reservation' and residence_id=p_residence_id
 and (p_year is null or academic_year=p_year)
 union all
 select id,status,created_at from public.applications
 where p_kind='application' and residence_id=p_residence_id
 and (p_year is null or academic_year=p_year)
), attempt as (
 select e.target_id,
 count(*) filter(where e.delivery_status='sent') as sent_count,
 count(*) filter(where e.delivery_status in ('sending','unknown')) as uncertain_count,
 count(*) filter(where e.delivery_status='failed') as failed_count,
 count(*) as attempted_count
 from public.reskonnect_outbound_emails e
 join cases c on c.id=e.target_id
 where e.target_kind=p_kind
 group by e.target_id
), grouped as (
 select c.id,c.status,c.created_at,
 coalesce(a.sent_count,0)::bigint as sent_count,
 coalesce(a.uncertain_count,0)::bigint as uncertain_count,
 coalesce(a.failed_count,0)::bigint as failed_count,
 coalesce(a.attempted_count,0)::bigint as attempted_count
 from cases c left join attempt a on a.target_id=c.id
)
select jsonb_build_object(
 'total_cases',count(*),
 'emailed_cases',count(*) filter(where sent_count>0),
 'unemailed_cases',count(*) filter(where sent_count=0),
 'sent_messages',coalesce(sum(sent_count),0),
 'never_attempted',count(*) filter(where attempted_count=0),
 'uncertain_only',count(*) filter(where sent_count=0 and uncertain_count>0),
 'failed_only',count(*) filter(where sent_count=0 and uncertain_count=0 and failed_count>0),
 'uncertain_attempts',coalesce(sum(uncertain_count),0),
 'failed_attempts',coalesce(sum(failed_count),0),
 'repeat_sent_cases',count(*) filter(where sent_count>1),
 'never_attempted_case_ids',coalesce(
   jsonb_agg(id order by created_at desc,id) filter(where attempted_count=0),'[]'::jsonb),
 'uncertain_only_case_ids',coalesce(
   jsonb_agg(id order by created_at desc,id) filter(where sent_count=0 and uncertain_count>0),'[]'::jsonb),
 'failed_only_case_ids',coalesce(
   jsonb_agg(id order by created_at desc,id) filter(where sent_count=0 and uncertain_count=0 and failed_count>0),'[]'::jsonb)
) from grouped
$fn$;
revoke all on function public.rk_email_delivery_coverage(text,uuid,integer) from public,anon,authenticated;
grant execute on function public.rk_email_delivery_coverage(text,uuid,integer) to service_role;
comment on function public.rk_email_delivery_coverage(text,uuid,integer) is
'Internal-only exact case-level audit reconciliation; mutually exclusive no-delivery buckets and explicit uncertainty.';
