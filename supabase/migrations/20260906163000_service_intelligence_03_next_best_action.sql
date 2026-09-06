-- Phase 3/10: Next Best Action Engine
-- SQL/rule driven. Zero AI calls.

create table if not exists public.adminos_next_best_actions (
  id uuid primary key default gen_random_uuid(),
  action_key text not null unique,
  contact_id uuid references public.adminos_contacts(id) on delete cascade,
  user_id uuid,
  entity_type text,
  entity_id uuid,
  priority integer not null default 50 check (priority between 0 and 100),
  action_type text not null,
  title text not null,
  rationale text,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_adminos_nba_active_priority on public.adminos_next_best_actions(active,priority desc,generated_at desc);
create index if not exists idx_adminos_nba_contact on public.adminos_next_best_actions(contact_id,active,priority desc);
create index if not exists idx_adminos_nba_user on public.adminos_next_best_actions(user_id,active,priority desc);
alter table public.adminos_next_best_actions enable row level security;
drop policy if exists "Next best actions visible to owner and staff" on public.adminos_next_best_actions;
create policy "Next best actions visible to owner and staff" on public.adminos_next_best_actions for select to authenticated using (user_id=auth.uid() or (select public.adminos_is_staff()));
revoke all on public.adminos_next_best_actions from anon;
grant select on public.adminos_next_best_actions to authenticated;

create or replace function public.adminos_refresh_next_best_actions() returns integer
language plpgsql security definer set search_path=public as $$
declare affected integer := 0;
begin
  update public.adminos_next_best_actions set active=false
  where active=true and completed_at is null;

  -- Accommodation application health actions.
  insert into public.adminos_next_best_actions(action_key,contact_id,user_id,entity_type,entity_id,priority,action_type,title,rationale,action_url,metadata,active,generated_at,expires_at)
  select concat('application:',h.application_id,':health:',h.health_band),h.contact_id,h.user_id,'application',h.application_id,
    case h.health_band when 'blocked' then 100 when 'incomplete' then 90 when 'attention' then 75 else 35 end,
    case h.health_band when 'blocked' then 'human_review' when 'incomplete' then 'complete_application' when 'attention' then 'improve_application' else 'track_application' end,
    case h.health_band when 'blocked' then 'Application needs staff review' when 'incomplete' then concat('Complete application — ',h.score,'% ready') when 'attention' then concat('Finish application — ',h.score,'% ready') else concat('Application ready — ',h.score,'%') end,
    case h.health_band when 'blocked' then 'A protected status or rejection requires human review.' when 'ready' then 'The application has the core information and documents needed for review.' else coalesce((h.missing_items->0->>'label'),'Complete the next missing requirement.') end,
    'https://www.reskonnect.org/my-applications',jsonb_build_object('score',h.score,'health_band',h.health_band,'missing_items',h.missing_items),true,now(),now()+interval '7 days'
  from public.adminos_application_health_scores h
  on conflict (action_key) do update set contact_id=excluded.contact_id,user_id=excluded.user_id,priority=excluded.priority,title=excluded.title,rationale=excluded.rationale,metadata=excluded.metadata,active=case when adminos_next_best_actions.completed_at is null then true else false end,generated_at=now(),expires_at=excluded.expires_at;
  get diagnostics affected = row_count;

  -- Reserved accommodation: the next step is to continue/confirm the reservation journey.
  insert into public.adminos_next_best_actions(action_key,contact_id,user_id,entity_type,entity_id,priority,action_type,title,rationale,action_url,metadata,active,generated_at,expires_at)
  select concat('reservation:',ar.id,':',ar.status),public.adminos_contact_id_for_user(ar.user_id),ar.user_id,'reservation',ar.id,70,'review_reservation',
    'Continue accommodation reservation',concat('Reservation status: ',ar.status),'https://www.reskonnect.org/my-applications',
    jsonb_build_object('academic_year',ar.academic_year,'funding_type',ar.funding_type,'room_preference',ar.room_preference,'residence_id',ar.residence_id),true,now(),now()+interval '14 days'
  from public.accommodation_reservations ar where lower(ar.status) in ('reserved','pending','new','awaiting_confirmation')
  on conflict (action_key) do update set active=case when adminos_next_best_actions.completed_at is null then true else false end,priority=excluded.priority,rationale=excluded.rationale,metadata=excluded.metadata,generated_at=now(),expires_at=excluded.expires_at;

  -- WIL: deterministic progression guidance.
  insert into public.adminos_next_best_actions(action_key,contact_id,user_id,entity_type,entity_id,priority,action_type,title,rationale,action_url,metadata,active,generated_at,expires_at)
  select concat('wil:',w.id,':',w.status),public.adminos_contact_id_for_user(w.student_id),w.student_id,'wil_application',w.id,
    case when lower(w.status) in ('needs_documents','documents_required','action_required') then 85 when lower(w.status) in ('submitted','new') then 55 else 45 end,
    case when lower(w.status) in ('needs_documents','documents_required','action_required') then 'wil_documents' else 'track_wil' end,
    case when lower(w.status) in ('needs_documents','documents_required','action_required') then 'WIL application needs documents' else 'Track WIL application' end,
    concat('Current WIL status: ',w.status),'https://www.reskonnect.org/wil',jsonb_build_object('status',w.status,'course',w.course,'campus',w.campus,'wil_duration',w.wil_duration),true,now(),now()+interval '14 days'
  from public.wil_applications w where lower(w.status) not in ('completed','placed','closed','withdrawn','rejected')
  on conflict (action_key) do update set active=case when adminos_next_best_actions.completed_at is null then true else false end,priority=excluded.priority,rationale=excluded.rationale,metadata=excluded.metadata,generated_at=now(),expires_at=excluded.expires_at;

  -- Application-support leads: progress from enquiry into a concrete next step.
  insert into public.adminos_next_best_actions(action_key,contact_id,user_id,entity_type,entity_id,priority,action_type,title,rationale,action_url,metadata,active,generated_at,expires_at)
  select concat('support:',q.id,':',q.status::text),public.adminos_contact_id_for_user(q.user_id),q.user_id,'application_support_query',q.id,
    case when q.documents_ready=false then 75 else 60 end,
    case when q.documents_ready=false then 'prepare_documents' when q.needs_accommodation then 'find_accommodation' else 'continue_application_support' end,
    case when q.documents_ready=false then 'Prepare application documents' when q.needs_accommodation then 'Continue to accommodation' else 'Continue application support' end,
    case when q.documents_ready=false then 'The applicant indicated that documents are not ready.' when q.needs_accommodation then 'The applicant requested accommodation support.' else 'The enquiry still has an open next step.' end,
    case when q.needs_accommodation then 'https://www.reskonnect.org/findmyres' else 'https://www.reskonnect.org/applications' end,
    jsonb_build_object('institution_type',q.institution_type::text,'institution',q.preferred_institution,'campus',q.preferred_campus,'programme',q.preferred_programme,'documents_ready',q.documents_ready),true,now(),now()+interval '7 days'
  from public.application_support_queries q where q.status::text not in ('completed','closed','cancelled','rejected')
  on conflict (action_key) do update set active=case when adminos_next_best_actions.completed_at is null then true else false end,priority=excluded.priority,rationale=excluded.rationale,metadata=excluded.metadata,generated_at=now(),expires_at=excluded.expires_at;

  return (select count(*)::integer from public.adminos_next_best_actions where active=true and completed_at is null and (expires_at is null or expires_at>now()));
end; $$;
revoke all on function public.adminos_refresh_next_best_actions() from public,anon;
grant execute on function public.adminos_refresh_next_best_actions() to authenticated;

create or replace function public.adminos_complete_next_best_action(p_action_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.adminos_is_staff() then raise exception 'Staff access required'; end if;
  update public.adminos_next_best_actions set completed_at=now(),completed_by=auth.uid(),active=false where id=p_action_id;
end; $$;
revoke all on function public.adminos_complete_next_best_action(uuid) from public,anon;
grant execute on function public.adminos_complete_next_best_action(uuid) to authenticated;

select public.adminos_refresh_next_best_actions();
do $$ begin if exists(select 1 from cron.job where jobname='adminos-next-best-action-refresh') then perform cron.unschedule('adminos-next-best-action-refresh'); end if; end $$;
select cron.schedule('adminos-next-best-action-refresh','*/5 * * * *',$job$ select public.adminos_refresh_next_best_actions(); $job$);