-- One shared, fail-closed outreach budget across Dimpho, the event worker and the desk.
-- Operational placement is deliberately separate from an institution/landlord decision.
create or replace function public.rk_normalize_phone(p_phone text) returns text
language plpgsql immutable set search_path='' as $$
declare v text := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
begin
  if length(v)=10 and left(v,1)='0' then v:='27'||substr(v,2);
  elsif length(v)=9 then v:='27'||v;
  elsif left(v,2)='00' then v:=substr(v,3); end if;
  return case when length(v) between 10 and 15 then '+'||v else null end;
end $$;

create table public.student_care_placements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  care_status text not null default 'placed' check(care_status in ('placed','seeking')),
  basis text not null,
  cutoff_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.student_care_placements enable row level security;
create policy "care placement self or staff read" on public.student_care_placements for select to authenticated
using(user_id=(select auth.uid()) or (select public.adminos_is_staff()));
create policy "care placement staff manage" on public.student_care_placements for all to authenticated
using((select public.adminos_is_staff())) with check((select public.adminos_is_staff()));
grant select,insert,update,delete on public.student_care_placements to authenticated;
grant all on public.student_care_placements to service_role;
insert into public.student_care_placements(user_id,basis,cutoff_at)
select distinct user_id,'Applied before semester 2: operational placement assumption','2026-07-01T00:00:00+02:00'::timestamptz
from public.applications where created_at < '2026-07-01T00:00:00+02:00' and user_id is not null
on conflict(user_id) do nothing;

create index if not exists rk_contacts_phone_idx on public.adminos_contacts(public.rk_normalize_phone(phone));
create index if not exists rk_profiles_phone_idx on public.profiles(public.rk_normalize_phone(coalesce(nullif(phone_e164,''),nullif(phone,''),phone_number)));

create or replace function public.rk_student_is_placed(p_user_id uuid,p_phone text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.profiles p
    where (p.id=p_user_id or public.rk_normalize_phone(coalesce(nullif(p.phone_e164,''),nullif(p.phone,''),p.phone_number))=public.rk_normalize_phone(p_phone))
    and (
      exists(select 1 from public.student_care_placements c where c.user_id=p.id and c.care_status='placed')
      or exists(select 1 from public.applications a where a.user_id=p.id and (a.moved_in or a.status='approved'))
    )
  )
$$;
revoke all on function public.rk_student_is_placed(uuid,text) from public,anon,authenticated;
grant execute on function public.rk_student_is_placed(uuid,text) to service_role;

create table public.student_followup_dispatches (
  attempt_key text primary key,
  phone text not null,
  user_id uuid references auth.users(id) on delete set null,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  purpose text not null check(purpose in ('recruitment','student_care')),
  reserved_at timestamptz not null default now()
);
create index student_followup_phone_time_idx on public.student_followup_dispatches(phone,reserved_at desc);
create index student_followup_user_time_idx on public.student_followup_dispatches(user_id,reserved_at desc);
create index student_followup_contact_idx on public.student_followup_dispatches(contact_id);
alter table public.student_followup_dispatches enable row level security;
create policy "staff read followup budget" on public.student_followup_dispatches for select to authenticated using((select public.adminos_is_staff()));
grant select on public.student_followup_dispatches to authenticated;
grant all on public.student_followup_dispatches to service_role;

-- Historical sends count immediately; deployment must not reset a student's budget.
insert into public.student_followup_dispatches(attempt_key,phone,user_id,contact_id,purpose,reserved_at)
select 'history:'||m.id,public.rk_normalize_phone(m.to_address),c.profile_user_id,m.contact_id,
  case when m.metadata->>'event_type' in ('csat_request','student_care_followup') then 'student_care' else 'recruitment' end,
  coalesce(m.sent_at,m.created_at)
from public.adminos_whatsapp_messages m left join public.adminos_contacts c on c.id=m.contact_id
where m.direction='outbound' and m.status not in ('failed','undelivered')
  and coalesce(m.sent_at,m.created_at) >= now()-interval '31 days'
  and public.rk_normalize_phone(m.to_address) is not null
  and (m.metadata->>'source'='followup_autopilot' or m.metadata->>'event_type' like 'proactive_%'
    or m.metadata->>'event_type' like 'conversion_followup_%'
    or m.metadata->>'event_type' in ('csat_request','document_attention','student_care_followup')
    or m.message_kind='marketing'
    or exists(select 1 from public.adminos_whatsapp_outbox o where o.id::text=m.metadata->>'outbox_id' and o.source_type like '%followup%'))
on conflict do nothing;

create or replace function public.rk_claim_student_followup(
 p_phone text,p_user_id uuid,p_contact_id uuid,p_key text,p_purpose text default 'recruitment'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_phone text:=public.rk_normalize_phone(p_phone); v_user uuid:=p_user_id; v_last timestamptz; v_lock bigint;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  if v_phone is null or nullif(btrim(p_key),'') is null or p_purpose not in ('recruitment','student_care') then
    return jsonb_build_object('allowed',false,'reason','invalid_followup_identity');
  end if;
  if v_user is null then select profile_user_id into v_user from public.adminos_contacts where id=p_contact_id; end if;
  if v_user is null then select id into v_user from public.profiles where public.rk_normalize_phone(coalesce(nullif(phone_e164,''),nullif(phone,''),phone_number))=v_phone order by created_at limit 1; end if;
  -- Lock the phone AND student, in a fixed order, before checking and reserving.
  for v_lock in select distinct x from unnest(array[hashtextextended('rk-followup-phone:'||v_phone,0),hashtextextended('rk-followup-user:'||coalesce(v_user::text,v_phone),0)]) x order by x loop
    perform pg_advisory_xact_lock(v_lock);
  end loop;
  if exists(select 1 from public.adminos_communication_preferences pref join public.adminos_contacts c on c.id=pref.contact_id
    where (c.id=p_contact_id or c.profile_user_id=v_user or public.rk_normalize_phone(c.phone)=v_phone)
    and (pref.do_not_contact or pref.whatsapp_allowed=false)) then
    return jsonb_build_object('allowed',false,'reason','contact_opted_out');
  end if;
  if p_purpose='recruitment' and public.rk_student_is_placed(v_user,v_phone) then
    return jsonb_build_object('allowed',false,'reason','student_already_placed');
  end if;
  if exists(select 1 from public.student_followup_dispatches where attempt_key=p_key) then
    return jsonb_build_object('allowed',false,'reason','attempt_already_reserved');
  end if;
  select max(reserved_at) into v_last from public.student_followup_dispatches where phone=v_phone or user_id=v_user;
  if v_last>=now()-interval '30 days' or date_trunc('month',v_last at time zone 'Africa/Johannesburg')=date_trunc('month',now() at time zone 'Africa/Johannesburg') then
    return jsonb_build_object('allowed',false,'reason','monthly_followup_limit','next_eligible_at',greatest(v_last+interval '30 days',(date_trunc('month',v_last at time zone 'Africa/Johannesburg')+interval '1 month') at time zone 'Africa/Johannesburg'));
  end if;
  insert into public.student_followup_dispatches(attempt_key,phone,user_id,contact_id,purpose) values(p_key,v_phone,v_user,p_contact_id,p_purpose);
  -- Reservations survive provider timeouts: an uncertain send must never be retried automatically.
  return jsonb_build_object('allowed',true,'reason','reserved');
end $$;
revoke all on function public.rk_claim_student_followup(text,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.rk_claim_student_followup(text,uuid,uuid,text,text) to service_role;

-- Stop already-queued recruitment and enrollment sequences for assumed/confirmed placements.
update public.adminos_followup_enrollments e set status='completed',next_run_at=null,completed_at=now(),
 metadata=coalesce(e.metadata,'{}')||jsonb_build_object('stopped_reason','student_already_placed')
from public.adminos_contacts c where c.id=e.contact_id and e.status in ('active','paused')
 and public.rk_student_is_placed(c.profile_user_id,c.phone);
update public.adminos_whatsapp_site_events e set status='blocked',processed_at=now(),last_error='student_already_placed',updated_at=now()
where e.status in ('pending','waiting_template','failed') and (event_type like 'proactive_%' or event_type like 'conversion_followup_%' or event_type='document_attention')
 and public.rk_student_is_placed(e.user_id,coalesce(e.phone,(select c.phone from public.adminos_contacts c where c.id=e.contact_id)));
update public.adminos_whatsapp_outbox o set status='blocked',last_error='student_already_placed'
where o.status in ('queued','draft','failed') and (source_type like '%followup%' or message_kind='marketing')
 and public.rk_student_is_placed((select c.profile_user_id from public.adminos_contacts c where c.id=o.contact_id),o.to_address);
update public.adminos_whatsapp_conversion_leads l set next_follow_up_at=null,
 metadata=coalesce(metadata,'{}')||jsonb_build_object('followup_paused_reason','student_already_placed'),updated_at=now()
where public.rk_student_is_placed(l.user_id,(select c.phone from public.adminos_contacts c where c.id=l.contact_id));

-- Do not let legacy 12/48-hour scheduling recreate aggressive followups.
create or replace function public.rk_enforce_followup_schedule() returns trigger language plpgsql set search_path='' as $$
begin
  if new.next_follow_up_at is not null then
    new.next_follow_up_at:=greatest(new.next_follow_up_at,coalesce(new.last_inbound_at,new.created_at,now())+interval '30 days');
    if tg_op='UPDATE' and new.follow_up_count>old.follow_up_count then new.next_follow_up_at:=greatest(new.next_follow_up_at,now()+interval '30 days'); end if;
  end if;
  return new;
end $$;
create trigger rk_monthly_conversion_schedule before insert or update on public.adminos_whatsapp_conversion_leads for each row execute function public.rk_enforce_followup_schedule();
revoke all on function public.rk_enforce_followup_schedule() from public,anon,authenticated;

create or replace function public.rk_guard_queued_followup() returns trigger language plpgsql security definer set search_path='' as $$
declare v_phone text; v_user uuid; v_last timestamptz;
begin
  if new.status not in ('pending','waiting_template','failed') or not (new.event_type like 'proactive_%' or new.event_type like 'conversion_followup_%' or new.event_type in ('document_attention','csat_request','student_care_followup')) then return new; end if;
  select coalesce(new.phone,c.phone),coalesce(new.user_id,c.profile_user_id) into v_phone,v_user from public.adminos_contacts c where c.id=new.contact_id;
  v_phone:=public.rk_normalize_phone(coalesce(v_phone,new.phone)); v_user:=coalesce(v_user,new.user_id);
  if new.event_type not in ('csat_request','student_care_followup') and public.rk_student_is_placed(v_user,v_phone) then
    new.status:='blocked';new.last_error:='student_already_placed';new.processed_at:=now();
  else
    select max(reserved_at) into v_last from public.student_followup_dispatches where phone=v_phone or user_id=v_user;
    if v_last>=now()-interval '30 days' or date_trunc('month',v_last at time zone 'Africa/Johannesburg')=date_trunc('month',now() at time zone 'Africa/Johannesburg') then
      new.status:='blocked';new.last_error:='monthly_followup_limit';new.processed_at:=now();
    end if;
  end if;
  return new;
end $$;
create trigger rk_monthly_followup_queue_guard before insert or update on public.adminos_whatsapp_site_events for each row execute function public.rk_guard_queued_followup();
revoke all on function public.rk_guard_queued_followup() from public,anon,authenticated;
