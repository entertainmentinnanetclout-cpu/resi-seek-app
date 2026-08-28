create table if not exists public.conversion_automation_tasks (
  id uuid primary key default gen_random_uuid(), task_type text not null, source_type text not null, source_id uuid not null,
  user_id uuid references auth.users(id) on delete set null, residence_id uuid references public.residences(id) on delete cascade,
  owner_scope text not null default 'admin', status text not null default 'pending' check(status in('pending','completed','cancelled')),
  priority text not null default 'normal' check(priority in('low','normal','high','urgent')), due_at timestamptz,
  summary text not null, payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), completed_at timestamptz, unique(source_type,source_id,task_type)
);
create index if not exists conversion_automation_tasks_due_idx on public.conversion_automation_tasks(status,due_at);
create index if not exists conversion_automation_tasks_residence_idx on public.conversion_automation_tasks(residence_id,status);
alter table public.conversion_automation_tasks enable row level security;
drop policy if exists "automation admins manage tasks" on public.conversion_automation_tasks;
create policy "automation admins manage tasks" on public.conversion_automation_tasks for all to authenticated using(public.can_manage_growth()) with check(public.can_manage_growth());
drop policy if exists "automation users view own tasks" on public.conversion_automation_tasks;
create policy "automation users view own tasks" on public.conversion_automation_tasks for select to authenticated using(user_id=auth.uid());

create or replace function public.touch_conversion_automation_task() returns trigger language plpgsql as $$ begin new.updated_at=now(); if new.status='completed' and new.completed_at is null then new.completed_at=now(); elsif new.status<>'completed' then new.completed_at=null; end if; return new; end $$;
drop trigger if exists trg_touch_conversion_automation_task on public.conversion_automation_tasks;
create trigger trg_touch_conversion_automation_task before update on public.conversion_automation_tasks for each row execute function public.touch_conversion_automation_task();

create or replace function public.automate_application_conversion() returns trigger language plpgsql security definer set search_path=public as $$
declare _status text:=lower(coalesce(new.status,'')); _due timestamptz; _summary text;
begin
  if _status in('approved','conditionally_approved','rejected','withdrawn','cancelled') then
    update public.conversion_automation_tasks set status='completed',completed_at=now(),payload=payload||jsonb_build_object('final_status',_status) where source_type='application' and source_id=new.id and task_type='application_follow_up' and status='pending'; return new;
  end if;
  _due:=case when _status='documents_required' then now()+interval '6 hours' else now()+interval '24 hours' end;
  _summary:=case when _status='documents_required' then 'Student needs documents or application data completed' else 'Application requires conversion follow-up' end;
  insert into public.conversion_automation_tasks(task_type,source_type,source_id,user_id,residence_id,owner_scope,status,priority,due_at,summary,payload)
  values('application_follow_up','application',new.id,new.user_id,new.residence_id,case when new.residence_id is null then 'admin' else 'residence' end,'pending',case when _status='documents_required' then 'high' else 'normal' end,_due,_summary,jsonb_build_object('status',_status,'funding_type',new.funding_type))
  on conflict(source_type,source_id,task_type) do update set status='pending',due_at=excluded.due_at,priority=excluded.priority,summary=excluded.summary,payload=excluded.payload,completed_at=null;
  if new.residence_id is not null then update public.residence_leads set next_follow_up_at=_due,updated_at=now() where source_type='application' and source_id=new.id; end if;
  return new;
end $$;
drop trigger if exists zz_trg_automation_application on public.applications;
create trigger zz_trg_automation_application after insert or update of status,funding_type on public.applications for each row execute function public.automate_application_conversion();

create or replace function public.automate_reservation_conversion() returns trigger language plpgsql security definer set search_path=public as $$
declare _status text:=lower(coalesce(new.status,'')); _due timestamptz:=now()+interval '12 hours';
begin
  if _status in('confirmed','cancelled','placed') then update public.conversion_automation_tasks set status='completed',completed_at=now(),payload=payload||jsonb_build_object('final_status',_status) where source_type='reservation' and source_id=new.id and task_type='reservation_follow_up' and status='pending'; return new; end if;
  insert into public.conversion_automation_tasks(task_type,source_type,source_id,user_id,residence_id,owner_scope,status,priority,due_at,summary,payload)
  values('reservation_follow_up','reservation',new.id,new.user_id,new.residence_id,'residence','pending','high',_due,'2027 reservation requires follow-up',jsonb_build_object('status',_status,'funding_type',new.funding_type,'room_preference',new.room_preference))
  on conflict(source_type,source_id,task_type) do update set status='pending',due_at=excluded.due_at,priority=excluded.priority,payload=excluded.payload,completed_at=null;
  update public.residence_leads set next_follow_up_at=_due,updated_at=now() where source_type='reservation' and source_id=new.id; return new;
end $$;
drop trigger if exists zz_trg_automation_reservation on public.accommodation_reservations;
create trigger zz_trg_automation_reservation after insert or update of status,funding_type,room_preference on public.accommodation_reservations for each row execute function public.automate_reservation_conversion();

create or replace function public.automate_creator_assistance() returns trigger language plpgsql security definer set search_path=public as $$
declare _status text:=lower(coalesce(new.status,'')); begin
  if _status in('completed','cancelled','revoked') then update public.conversion_automation_tasks set status='completed',completed_at=now() where source_type='creator_assistance' and source_id=new.id and task_type='creator_case_next_action' and status='pending';
  else insert into public.conversion_automation_tasks(task_type,source_type,source_id,user_id,owner_scope,status,priority,due_at,summary,payload)
    values('creator_case_next_action','creator_assistance',new.id,new.student_user_id,'creator','pending',case when _status='documents_pending' then 'high' else 'normal' end,now()+case when _status='documents_pending' then interval '12 hours' else interval '24 hours' end,'Creator application assistance case needs next action',jsonb_build_object('status',_status,'creator_id',new.creator_id))
    on conflict(source_type,source_id,task_type) do update set status='pending',due_at=excluded.due_at,priority=excluded.priority,payload=excluded.payload,completed_at=null; end if; return new;
end $$;
drop trigger if exists zz_trg_automation_creator_assistance on public.creator_assistance_cases;
create trigger zz_trg_automation_creator_assistance after insert or update of status on public.creator_assistance_cases for each row execute function public.automate_creator_assistance();

create or replace function public.automate_residence_quality() returns trigger language plpgsql security definer set search_path=public as $$ begin
  if coalesce(new.data_quality_score,0)>=90 then update public.conversion_automation_tasks set status='completed',completed_at=now() where source_type='residence' and source_id=new.id and task_type='listing_quality' and status='pending';
  else insert into public.conversion_automation_tasks(task_type,source_type,source_id,residence_id,owner_scope,status,priority,due_at,summary,payload)
    values('listing_quality','residence',new.id,new.id,'admin','pending',case when coalesce(new.data_quality_score,0)<50 then 'high' else 'normal' end,now()+interval '48 hours','Residence listing needs data-quality completion',jsonb_build_object('quality_score',coalesce(new.data_quality_score,0),'missing',coalesce(to_jsonb(new.data_quality_missing),'[]'::jsonb)))
    on conflict(source_type,source_id,task_type) do update set status='pending',priority=excluded.priority,due_at=excluded.due_at,payload=excluded.payload,completed_at=null; end if; return new;
end $$;
drop trigger if exists zz_trg_automation_residence_quality on public.residences;
create trigger zz_trg_automation_residence_quality after insert or update of data_quality_score,data_quality_missing on public.residences for each row execute function public.automate_residence_quality();

create or replace function public.automation_command_center() returns jsonb language sql stable security definer set search_path=public as $$
  select case when public.can_manage_growth() then jsonb_build_object('pending',count(*) filter(where status='pending'),'overdue',count(*) filter(where status='pending' and due_at<now()),'urgent',count(*) filter(where status='pending' and priority='urgent'),'high',count(*) filter(where status='pending' and priority='high'),'due_today',count(*) filter(where status='pending' and due_at<date_trunc('day',now())+interval '1 day'),'by_type',coalesce((select jsonb_object_agg(task_type,cnt) from(select task_type,count(*) cnt from public.conversion_automation_tasks where status='pending' group by task_type)s),'{}'::jsonb)) else null end from public.conversion_automation_tasks
$$;
revoke all on function public.automation_command_center() from public;
grant execute on function public.automation_command_center() to authenticated;
