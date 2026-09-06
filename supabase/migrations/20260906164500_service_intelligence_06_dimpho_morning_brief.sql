-- Phase 6/10: Dimpho Executive Morning Brief
-- Generated entirely from SQL metrics; no AI token usage.

create table if not exists public.adminos_executive_briefs (
  id uuid primary key default gen_random_uuid(),
  brief_date date not null unique,
  persona text not null default 'Dimpho',
  headline text not null,
  metrics jsonb not null default '{}'::jsonb,
  priorities jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
alter table public.adminos_executive_briefs enable row level security;
drop policy if exists "AdminOS staff read executive briefs" on public.adminos_executive_briefs;
create policy "AdminOS staff read executive briefs" on public.adminos_executive_briefs for select to authenticated using ((select public.adminos_is_staff()));
revoke all on public.adminos_executive_briefs from anon;
grant select on public.adminos_executive_briefs to authenticated;

create or replace function public.adminos_generate_executive_brief(p_date date default (now() at time zone 'Africa/Johannesburg')::date)
returns public.adminos_executive_briefs
language plpgsql security definer set search_path=public as $$
declare
  v_unread_count integer := 0;
  v_escalated_count integer := 0;
  v_application_attention integer := 0;
  v_application_blocked integer := 0;
  v_residence_needs_data integer := 0;
  v_residence_missing_images integer := 0;
  v_open_wil integer := 0;
  v_proactive_waiting integer := 0;
  v_inbound_24h integer := 0;
  v_outbound_24h integer := 0;
  v_active_actions integer := 0;
  priorities_value jsonb := '[]'::jsonb;
  result public.adminos_executive_briefs%rowtype;
begin
  select coalesce(sum(t.unread_count),0)::integer,
         count(*) filter (where t.status='escalated' or t.mode='escalated')::integer
  into v_unread_count,v_escalated_count from public.adminos_whatsapp_threads t;

  select count(*) filter (where h.health_band in ('attention','incomplete'))::integer,
         count(*) filter (where h.health_band='blocked')::integer
  into v_application_attention,v_application_blocked from public.adminos_application_health_scores h;

  select count(*) filter (where r.readiness_score<70)::integer,
         count(*) filter (where not r.has_image)::integer
  into v_residence_needs_data,v_residence_missing_images from public.adminos_residence_readiness_v r;

  select count(*)::integer into v_open_wil from public.wil_applications w
  where lower(w.status) not in ('completed','placed','closed','withdrawn','rejected');

  select count(*)::integer into v_proactive_waiting from public.adminos_whatsapp_site_events e
  where e.event_type like 'proactive_%' and e.status in ('pending','processing','waiting_template','failed');

  select count(*) filter (where m.direction='inbound')::integer,
         count(*) filter (where m.direction='outbound')::integer
  into v_inbound_24h,v_outbound_24h from public.adminos_whatsapp_messages m where m.created_at>=now()-interval '24 hours';

  select count(*)::integer into v_active_actions from public.adminos_next_best_actions n
  where n.active=true and n.completed_at is null and (n.expires_at is null or n.expires_at>now());

  if v_escalated_count>0 then priorities_value:=priorities_value||jsonb_build_array(jsonb_build_object('priority',100,'area','communications','title',concat(v_escalated_count,' escalated WhatsApp conversation',case when v_escalated_count=1 then '' else 's' end),'url','/admin/system?tab=communications')); end if;
  if v_application_blocked>0 then priorities_value:=priorities_value||jsonb_build_array(jsonb_build_object('priority',95,'area','applications','title',concat(v_application_blocked,' blocked application',case when v_application_blocked=1 then '' else 's' end,' need human review'),'url','/admin/system?tab=operations')); end if;
  if v_application_attention>0 then priorities_value:=priorities_value||jsonb_build_array(jsonb_build_object('priority',85,'area','applications','title',concat(v_application_attention,' application',case when v_application_attention=1 then '' else 's' end,' below readiness target'),'url','/admin/system?tab=operations')); end if;
  if v_residence_missing_images>0 then priorities_value:=priorities_value||jsonb_build_array(jsonb_build_object('priority',75,'area','residences','title',concat(v_residence_missing_images,' published residence',case when v_residence_missing_images=1 then '' else 's' end,' need images'),'url','/admin/system?tab=communications')); end if;
  if v_proactive_waiting>0 then priorities_value:=priorities_value||jsonb_build_array(jsonb_build_object('priority',65,'area','automation','title',concat(v_proactive_waiting,' proactive WhatsApp notification',case when v_proactive_waiting=1 then '' else 's' end,' waiting'),'url','/admin/system?tab=automation')); end if;

  insert into public.adminos_executive_briefs(brief_date,persona,headline,metrics,priorities,generated_at)
  values(p_date,'Dimpho',
    concat('Dimpho brief: ',v_escalated_count,' escalated conversations, ',v_application_attention+v_application_blocked,' applications needing attention, and ',v_residence_needs_data,' residences below service-readiness target.'),
    jsonb_build_object(
      'whatsapp_unread',v_unread_count,'whatsapp_escalated',v_escalated_count,
      'applications_attention',v_application_attention,'applications_blocked',v_application_blocked,
      'residences_needs_data',v_residence_needs_data,'residences_missing_images',v_residence_missing_images,
      'wil_open',v_open_wil,'proactive_waiting',v_proactive_waiting,
      'whatsapp_inbound_24h',v_inbound_24h,'whatsapp_outbound_24h',v_outbound_24h,
      'active_next_best_actions',v_active_actions
    ),priorities_value,now())
  on conflict (brief_date) do update set persona=excluded.persona,headline=excluded.headline,metrics=excluded.metrics,priorities=excluded.priorities,generated_at=excluded.generated_at
  returning * into result;
  return result;
end; $$;
revoke all on function public.adminos_generate_executive_brief(date) from public,anon;
grant execute on function public.adminos_generate_executive_brief(date) to authenticated;

select public.adminos_generate_executive_brief();
do $$ begin if exists(select 1 from cron.job where jobname='adminos-dimpho-morning-brief') then perform cron.unschedule('adminos-dimpho-morning-brief'); end if; end $$;
select cron.schedule('adminos-dimpho-morning-brief','15 5 * * *',$job$ select public.adminos_generate_executive_brief(); $job$);