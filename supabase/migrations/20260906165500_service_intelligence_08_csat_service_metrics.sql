-- Phase 8/10: CSAT + response-time analytics
-- All metrics are SQL-derived. No AI calls.

create table if not exists public.adminos_csat_responses (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.adminos_whatsapp_threads(id) on delete cascade,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  score smallint not null check (score between 1 and 5),
  rating_label text not null,
  comment text,
  source_message_id uuid references public.adminos_whatsapp_messages(id) on delete set null,
  language text not null default 'en',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(thread_id)
);
create index if not exists idx_adminos_csat_created on public.adminos_csat_responses(created_at desc);
alter table public.adminos_csat_responses enable row level security;
drop policy if exists "AdminOS staff read CSAT" on public.adminos_csat_responses;
create policy "AdminOS staff read CSAT" on public.adminos_csat_responses for select to authenticated using ((select public.adminos_is_staff()));
revoke all on public.adminos_csat_responses from anon;
grant select on public.adminos_csat_responses to authenticated;

create table if not exists public.adminos_service_metrics_daily (
  metric_date date primary key,
  conversations integer not null default 0,
  inbound_messages integer not null default 0,
  outbound_messages integer not null default 0,
  ai_outbound integer not null default 0,
  human_outbound integer not null default 0,
  delivered_messages integer not null default 0,
  failed_messages integer not null default 0,
  avg_first_response_seconds numeric,
  p90_first_response_seconds numeric,
  response_under_60s_pct numeric,
  avg_resolution_seconds numeric,
  csat_average numeric,
  csat_count integer not null default 0,
  csat_positive_pct numeric,
  recovery_open integer not null default 0,
  generated_at timestamptz not null default now()
);
alter table public.adminos_service_metrics_daily enable row level security;
drop policy if exists "AdminOS staff read service metrics" on public.adminos_service_metrics_daily;
create policy "AdminOS staff read service metrics" on public.adminos_service_metrics_daily for select to authenticated using ((select public.adminos_is_staff()));
revoke all on public.adminos_service_metrics_daily from anon;
grant select on public.adminos_service_metrics_daily to authenticated;

insert into public.adminos_whatsapp_rich_content(content_key,display_name,content_type,approval_required,purpose,config,status)
values('rk_csat_request','ResKonnect service rating','twilio/quick-reply',true,'transactional',
  jsonb_build_object('body','Hi {{1}}, Dimpho here. How was your ResKonnect service experience today?','actions',jsonb_build_array(
    jsonb_build_object('type','QUICK_REPLY','title','Excellent','id','csat:5'),
    jsonb_build_object('type','QUICK_REPLY','title','Good','id','csat:4'),
    jsonb_build_object('type','QUICK_REPLY','title','Needs improvement','id','csat:2')
  )),'not_created')
on conflict (content_key) do update set display_name=excluded.display_name,content_type=excluded.content_type,approval_required=excluded.approval_required,purpose=excluded.purpose,config=excluded.config,updated_at=now();

create or replace function public.adminos_queue_csat_on_resolution() returns trigger
language plpgsql security definer set search_path=public as $$
declare c public.adminos_contacts%rowtype;
begin
  if (new.resolved_at is not null and old.resolved_at is null) or (new.status='resolved' and old.status is distinct from 'resolved') then
    select * into c from public.adminos_contacts where id=new.contact_id;
    if c.id is not null and nullif(c.phone,'') is not null then
      insert into public.adminos_whatsapp_site_events(event_type,source_table,source_id,user_id,contact_id,phone,payload,status,available_at,idempotency_key)
      values('csat_request','adminos_whatsapp_threads',new.id,c.profile_user_id,c.id,c.phone,
        jsonb_build_object('user_name',coalesce(c.full_name,'there'),'thread_id',new.id),'pending',now()+interval '2 minutes',concat('csat:',new.id))
      on conflict (idempotency_key) do nothing;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_adminos_queue_csat_resolution on public.adminos_whatsapp_threads;
create trigger trg_adminos_queue_csat_resolution after update of resolved_at,status on public.adminos_whatsapp_threads
for each row execute function public.adminos_queue_csat_on_resolution();

create or replace function public.adminos_record_csat(p_thread_id uuid,p_score integer,p_source_message_id uuid default null,p_comment text default null,p_language text default 'en')
returns public.adminos_csat_responses
language plpgsql security definer set search_path=public as $$
declare t public.adminos_whatsapp_threads%rowtype; result public.adminos_csat_responses%rowtype;
begin
  if p_score<1 or p_score>5 then raise exception 'CSAT score must be 1-5'; end if;
  select * into t from public.adminos_whatsapp_threads where id=p_thread_id;
  if t.id is null then raise exception 'Conversation not found'; end if;
  insert into public.adminos_csat_responses(thread_id,contact_id,score,rating_label,comment,source_message_id,language,metadata)
  values(t.id,t.contact_id,p_score,case when p_score>=5 then 'excellent' when p_score>=4 then 'good' when p_score>=3 then 'okay' else 'needs_improvement' end,p_comment,p_source_message_id,coalesce(nullif(p_language,''),'en'),jsonb_build_object('source','whatsapp'))
  on conflict (thread_id) do update set score=excluded.score,rating_label=excluded.rating_label,comment=coalesce(excluded.comment,adminos_csat_responses.comment),source_message_id=coalesce(excluded.source_message_id,adminos_csat_responses.source_message_id),language=excluded.language,metadata=adminos_csat_responses.metadata||excluded.metadata,created_at=now()
  returning * into result;
  return result;
end; $$;
revoke all on function public.adminos_record_csat(uuid,integer,uuid,text,text) from public,anon;

create or replace function public.adminos_refresh_service_metrics(p_date date default (now() at time zone 'Africa/Johannesburg')::date)
returns public.adminos_service_metrics_daily
language plpgsql security definer set search_path=public as $$
declare start_at timestamptz; end_at timestamptz; result public.adminos_service_metrics_daily%rowtype;
begin
  start_at := (p_date::timestamp at time zone 'Africa/Johannesburg'); end_at:=start_at+interval '1 day';
  insert into public.adminos_service_metrics_daily(metric_date,conversations,inbound_messages,outbound_messages,ai_outbound,human_outbound,delivered_messages,failed_messages,avg_first_response_seconds,p90_first_response_seconds,response_under_60s_pct,avg_resolution_seconds,csat_average,csat_count,csat_positive_pct,recovery_open,generated_at)
  select p_date,
    (select count(distinct thread_id)::integer from public.adminos_whatsapp_messages where created_at>=start_at and created_at<end_at),
    (select count(*)::integer from public.adminos_whatsapp_messages where direction='inbound' and created_at>=start_at and created_at<end_at),
    (select count(*)::integer from public.adminos_whatsapp_messages where direction='outbound' and created_at>=start_at and created_at<end_at),
    (select count(*)::integer from public.adminos_whatsapp_messages where direction='outbound' and metadata->>'author_type'='ai' and created_at>=start_at and created_at<end_at),
    (select count(*)::integer from public.adminos_whatsapp_messages where direction='outbound' and coalesce(metadata->>'author_type','') in ('human','staff') and created_at>=start_at and created_at<end_at),
    (select count(*)::integer from public.adminos_whatsapp_messages where direction='outbound' and status in ('delivered','read') and created_at>=start_at and created_at<end_at),
    (select count(*)::integer from public.adminos_whatsapp_messages where direction='outbound' and status in ('failed','undelivered') and created_at>=start_at and created_at<end_at),
    (select round(avg(response_seconds)::numeric,1) from (
      select extract(epoch from (first_out-first_in)) response_seconds from (
        select t.id,
          (select min(coalesce(m.received_at,m.created_at)) from public.adminos_whatsapp_messages m where m.thread_id=t.id and m.direction='inbound' and m.created_at>=start_at and m.created_at<end_at) first_in,
          (select min(coalesce(m.sent_at,m.created_at)) from public.adminos_whatsapp_messages m where m.thread_id=t.id and m.direction='outbound' and coalesce(m.sent_at,m.created_at)>=(select min(coalesce(mi.received_at,mi.created_at)) from public.adminos_whatsapp_messages mi where mi.thread_id=t.id and mi.direction='inbound' and mi.created_at>=start_at and mi.created_at<end_at)) first_out
        from public.adminos_whatsapp_threads t
      ) z where first_in is not null and first_out is not null and first_out>=first_in
    ) q),
    (select round(percentile_cont(0.9) within group(order by response_seconds)::numeric,1) from (
      select extract(epoch from (first_out-first_in)) response_seconds from (
        select t.id,
          (select min(coalesce(m.received_at,m.created_at)) from public.adminos_whatsapp_messages m where m.thread_id=t.id and m.direction='inbound' and m.created_at>=start_at and m.created_at<end_at) first_in,
          (select min(coalesce(m.sent_at,m.created_at)) from public.adminos_whatsapp_messages m where m.thread_id=t.id and m.direction='outbound' and coalesce(m.sent_at,m.created_at)>=(select min(coalesce(mi.received_at,mi.created_at)) from public.adminos_whatsapp_messages mi where mi.thread_id=t.id and mi.direction='inbound' and mi.created_at>=start_at and mi.created_at<end_at)) first_out
        from public.adminos_whatsapp_threads t
      ) z where first_in is not null and first_out is not null and first_out>=first_in
    ) q),
    (select round(100.0*count(*) filter(where response_seconds<=60)/nullif(count(*),0),1) from (
      select extract(epoch from (first_out-first_in)) response_seconds from (
        select t.id,(select min(coalesce(m.received_at,m.created_at)) from public.adminos_whatsapp_messages m where m.thread_id=t.id and m.direction='inbound' and m.created_at>=start_at and m.created_at<end_at) first_in,(select min(coalesce(m.sent_at,m.created_at)) from public.adminos_whatsapp_messages m where m.thread_id=t.id and m.direction='outbound' and coalesce(m.sent_at,m.created_at)>=(select min(coalesce(mi.received_at,mi.created_at)) from public.adminos_whatsapp_messages mi where mi.thread_id=t.id and mi.direction='inbound' and mi.created_at>=start_at and mi.created_at<end_at)) first_out from public.adminos_whatsapp_threads t
      ) z where first_in is not null and first_out is not null and first_out>=first_in
    ) q),
    (select round(avg(extract(epoch from (t.resolved_at-first_in)))::numeric,1) from public.adminos_whatsapp_threads t cross join lateral (select min(coalesce(m.received_at,m.created_at)) first_in from public.adminos_whatsapp_messages m where m.thread_id=t.id and m.direction='inbound') x where t.resolved_at>=start_at and t.resolved_at<end_at and first_in is not null and t.resolved_at>=first_in),
    (select round(avg(score)::numeric,2) from public.adminos_csat_responses where created_at>=start_at and created_at<end_at),
    (select count(*)::integer from public.adminos_csat_responses where created_at>=start_at and created_at<end_at),
    (select round(100.0*count(*) filter(where score>=4)/nullif(count(*),0),1) from public.adminos_csat_responses where created_at>=start_at and created_at<end_at),
    (select count(*)::integer from public.adminos_service_recovery_items where status in ('open','in_progress')),
    now()
  on conflict (metric_date) do update set conversations=excluded.conversations,inbound_messages=excluded.inbound_messages,outbound_messages=excluded.outbound_messages,ai_outbound=excluded.ai_outbound,human_outbound=excluded.human_outbound,delivered_messages=excluded.delivered_messages,failed_messages=excluded.failed_messages,avg_first_response_seconds=excluded.avg_first_response_seconds,p90_first_response_seconds=excluded.p90_first_response_seconds,response_under_60s_pct=excluded.response_under_60s_pct,avg_resolution_seconds=excluded.avg_resolution_seconds,csat_average=excluded.csat_average,csat_count=excluded.csat_count,csat_positive_pct=excluded.csat_positive_pct,recovery_open=excluded.recovery_open,generated_at=excluded.generated_at
  returning * into result;
  return result;
end; $$;
revoke all on function public.adminos_refresh_service_metrics(date) from public,anon;
grant execute on function public.adminos_refresh_service_metrics(date) to authenticated;

select public.adminos_refresh_service_metrics();
do $$ begin if exists(select 1 from cron.job where jobname='adminos-service-metrics-refresh') then perform cron.unschedule('adminos-service-metrics-refresh'); end if; end $$;
select cron.schedule('adminos-service-metrics-refresh','*/15 * * * *',$job$ select public.adminos_refresh_service_metrics(); $job$);