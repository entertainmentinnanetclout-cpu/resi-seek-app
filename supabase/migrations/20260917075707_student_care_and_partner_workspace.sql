
-- Residence care: reusable campaigns, private responses and strictly single rooms.
create table public.residence_feedback_campaigns (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 3 and 160),
 academic_year integer not null check(academic_year between 2020 and 2100),
 residence_id uuid references public.residences(id) on delete set null,
 description text not null default '', is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create index residence_feedback_campaign_res_idx on public.residence_feedback_campaigns(residence_id);
alter table public.residence_feedback_campaigns enable row level security;
create policy "read active residence feedback campaigns" on public.residence_feedback_campaigns for select to anon,authenticated using(is_active);
create policy "staff manage feedback campaigns" on public.residence_feedback_campaigns for all to authenticated using((select public.adminos_is_staff())) with check((select public.adminos_is_staff()));
grant select on public.residence_feedback_campaigns to anon;
grant select,insert,update,delete on public.residence_feedback_campaigns to authenticated;
insert into public.residence_feedback_campaigns(title,academic_year,description) values
 ('2026 Residence Stay Feedback & Student Voice',2026,'Tell us about your stay, raise concerns and help us seek improvements with your residence and institution.');

create table public.residence_stay_feedback (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.residence_feedback_campaigns(id),
 user_id uuid not null references auth.users(id), residence_id uuid references public.residences(id),
 residence_name text not null check(length(btrim(residence_name)) between 2 and 200),
 campus text not null check(length(btrim(campus)) between 2 and 200), institution text not null default '',
 stay_semester smallint not null check(stay_semester in (1,2)),
 safety_rating smallint not null check(safety_rating between 1 and 5),
 maintenance_rating smallint not null check(maintenance_rating between 1 and 5),
 management_rating smallint not null check(management_rating between 1 and 5),
 overall_rating smallint not null check(overall_rating between 1 and 5),
 concerns text not null default '' check(length(concerns)<=8000), improvements text not null default '' check(length(improvements)<=8000),
 urgent_safety_concern boolean not null default false, petition_support boolean not null default false,
 share_with_institution boolean not null default false, share_identity boolean not null default false,
 status text not null default 'received' check(status in ('received','reviewing','raised_with_residence','raised_with_institution','resolved')),
 staff_response text not null default '', institution_response text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(campaign_id,user_id), check(not share_identity or share_with_institution), check(not petition_support or share_with_institution)
);
create index residence_feedback_user_idx on public.residence_stay_feedback(user_id);
create index residence_feedback_res_idx on public.residence_stay_feedback(residence_id);
alter table public.residence_stay_feedback enable row level security;
create policy "student reads own residence feedback" on public.residence_stay_feedback for select to authenticated using(user_id=(select auth.uid()));
create policy "staff manages residence feedback" on public.residence_stay_feedback for all to authenticated using((select public.adminos_is_staff())) with check((select public.adminos_is_staff()));
grant select,insert,update,delete on public.residence_stay_feedback to authenticated;

create or replace function public.rk_submit_residence_feedback(p_campaign_id uuid,p_feedback jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_campaign public.residence_feedback_campaigns;
begin
 if auth.uid() is null then raise exception 'Sign in to submit feedback' using errcode='42501'; end if;
 select * into v_campaign from public.residence_feedback_campaigns where id=p_campaign_id and is_active;
 if not found then raise exception 'This feedback campaign is closed'; end if;
 insert into public.residence_stay_feedback(campaign_id,user_id,residence_id,residence_name,campus,institution,stay_semester,safety_rating,maintenance_rating,management_rating,overall_rating,concerns,improvements,urgent_safety_concern,petition_support,share_with_institution,share_identity)
 values(p_campaign_id,auth.uid(),coalesce(v_campaign.residence_id,nullif(p_feedback->>'residence_id','')::uuid),btrim(p_feedback->>'residence_name'),btrim(p_feedback->>'campus'),coalesce(p_feedback->>'institution',''),(p_feedback->>'stay_semester')::smallint,(p_feedback->>'safety_rating')::smallint,(p_feedback->>'maintenance_rating')::smallint,(p_feedback->>'management_rating')::smallint,(p_feedback->>'overall_rating')::smallint,coalesce(p_feedback->>'concerns',''),coalesce(p_feedback->>'improvements',''),coalesce((p_feedback->>'urgent_safety_concern')::boolean,false),coalesce((p_feedback->>'petition_support')::boolean,false),coalesce((p_feedback->>'share_with_institution')::boolean,false),coalesce((p_feedback->>'share_identity')::boolean,false))
 on conflict(campaign_id,user_id) do update set residence_name=excluded.residence_name,campus=excluded.campus,institution=excluded.institution,
 stay_semester=excluded.stay_semester,safety_rating=excluded.safety_rating,maintenance_rating=excluded.maintenance_rating,
 management_rating=excluded.management_rating,overall_rating=excluded.overall_rating,concerns=excluded.concerns,improvements=excluded.improvements,
 urgent_safety_concern=excluded.urgent_safety_concern,petition_support=excluded.petition_support,share_with_institution=excluded.share_with_institution,
 share_identity=excluded.share_identity,status='received',updated_at=now() returning id into v_id;
 return v_id;
end $$;
revoke all on function public.rk_submit_residence_feedback(uuid,jsonb) from public,anon;
grant execute on function public.rk_submit_residence_feedback(uuid,jsonb) to authenticated;

create table public.single_room_waitlist (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 academic_year integer not null check(academic_year between 2026 and 2100), semester smallint not null check(semester in (1,2)),
 room_type text not null default 'single' check(room_type='single'),
 full_name text not null check(length(btrim(full_name)) between 2 and 160),
 phone text not null check(public.rk_normalize_phone(phone) is not null),
 campus text not null check(length(btrim(campus)) between 2 and 200),
 preferred_residence text not null default '', budget numeric(10,2) check(budget>=0),
 funding_type text not null default 'undecided', move_in_date date, notes text not null default '' check(length(notes)<=3000),
 status text not null default 'waiting' check(status in ('waiting','searching','matched','placed','withdrawn')),
 matched_residence_id uuid references public.residences(id), staff_response text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,academic_year,semester)
);
create index single_room_waitlist_year_status_idx on public.single_room_waitlist(academic_year,status);
create index single_room_waitlist_match_idx on public.single_room_waitlist(matched_residence_id);
alter table public.single_room_waitlist enable row level security;
create policy "student sees own single room request" on public.single_room_waitlist for select to authenticated using(user_id=(select auth.uid()));
create policy "staff manages single room requests" on public.single_room_waitlist for all to authenticated using((select public.adminos_is_staff())) with check((select public.adminos_is_staff()));
grant select,insert,update,delete on public.single_room_waitlist to authenticated;
create or replace function public.rk_join_single_room_waitlist(p_request jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to join the waiting list' using errcode='42501'; end if;
 if coalesce(p_request->>'room_type','single')<>'single' then raise exception 'This waiting list is strictly for single rooms'; end if;
 insert into public.single_room_waitlist(user_id,academic_year,semester,full_name,phone,campus,preferred_residence,budget,funding_type,move_in_date,notes)
 values(auth.uid(),(p_request->>'academic_year')::integer,(p_request->>'semester')::smallint,btrim(p_request->>'full_name'),public.rk_normalize_phone(p_request->>'phone'),btrim(p_request->>'campus'),coalesce(p_request->>'preferred_residence',''),nullif(p_request->>'budget','')::numeric,coalesce(p_request->>'funding_type','undecided'),nullif(p_request->>'move_in_date','')::date,coalesce(p_request->>'notes',''))
 on conflict(user_id,academic_year,semester) do update set full_name=excluded.full_name,phone=excluded.phone,campus=excluded.campus,
 preferred_residence=excluded.preferred_residence,budget=excluded.budget,funding_type=excluded.funding_type,move_in_date=excluded.move_in_date,notes=excluded.notes,
 status=case when single_room_waitlist.status='withdrawn' then 'waiting' else single_room_waitlist.status end,updated_at=now() returning id into v_id;
 return v_id;
end $$;
create or replace function public.rk_withdraw_single_room(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 update public.single_room_waitlist set status='withdrawn',updated_at=now() where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Waiting list entry unavailable'; end if;
end $$;
create or replace function public.rk_single_room_waitlist_count(p_year integer default 2027) returns bigint
language sql stable security definer set search_path='' as $$ select count(*) from public.single_room_waitlist where academic_year=p_year and status in ('waiting','searching','matched') $$;
revoke all on function public.rk_join_single_room_waitlist(jsonb),public.rk_withdraw_single_room(uuid),public.rk_single_room_waitlist_count(integer) from public,anon;
grant execute on function public.rk_join_single_room_waitlist(jsonb),public.rk_withdraw_single_room(uuid) to authenticated;
grant execute on function public.rk_single_room_waitlist_count(integer) to anon,authenticated;

-- Approved application partners share the existing consented assistance workspace.
alter table public.creator_partners
 add column partner_kind text not null default 'creator' check(partner_kind in ('creator','application')),
 add column assistance_fee numeric(6,2) not null default 0 check(assistance_fee between 0 and 100);
create or replace function public.rk_guard_partner_profile() returns trigger language plpgsql set search_path='' as $$
begin
 if auth.role()='service_role' or public.can_manage_growth() then return new; end if;
 if tg_op='INSERT' then
  if new.user_id is distinct from auth.uid() or new.status<>'pending' or new.tier<>'creator_partner' or new.payout_per_placement<>0 or new.payout_per_verified_reservation<>0 then raise exception 'Partners require ResKonnect approval' using errcode='42501'; end if;
 elsif new.user_id is distinct from old.user_id or new.status is distinct from old.status or new.tier is distinct from old.tier or new.payout_per_placement is distinct from old.payout_per_placement or new.payout_per_verified_reservation is distinct from old.payout_per_verified_reservation then
  raise exception 'Only ResKonnect may change partner approval or commission terms' using errcode='42501';
 end if;
 return new;
end $$;
create trigger rk_partner_approval_guard before insert or update on public.creator_partners for each row execute function public.rk_guard_partner_profile();
revoke all on function public.rk_guard_partner_profile() from public,anon,authenticated;

alter table public.creator_assistance_cases
 add column intake_semester smallint not null default 1 check(intake_semester in (1,2)),
 add column service_fee numeric(6,2) not null default 0 check(service_fee between 0 and 100),
 add column fee_accepted_at timestamptz;
-- One fee covers the whole annual case, including all institution choices.
create or replace function public.rk_guard_assistance_case() returns trigger language plpgsql set search_path='' as $$
declare v_fee numeric;
begin
 if tg_op='INSERT' then
  select assistance_fee into v_fee from public.creator_partners where id=new.creator_id and status='active';
  if v_fee is null then raise exception 'Choose an approved application partner'; end if;
  if new.service_fee is distinct from v_fee then raise exception 'The partner fee changed. Refresh and review the fee before continuing.'; end if;
  new.fee_accepted_at:=now();
  if not public.can_manage_growth() and auth.role() is distinct from 'service_role' and (new.status not in ('requested','documents_pending') or new.consent_status<>'granted' or new.student_user_id is distinct from auth.uid()) then raise exception 'Invalid student intake'; end if;
 elsif auth.role() is distinct from 'service_role' and not public.can_manage_growth() then
  if new.student_user_id is distinct from old.student_user_id or new.creator_id is distinct from old.creator_id or new.intake_year is distinct from old.intake_year or new.service_fee is distinct from old.service_fee or new.fee_accepted_at is distinct from old.fee_accepted_at then raise exception 'The agreed partner, year and fee cannot be changed'; end if;
  if auth.uid()=old.student_user_id then
   if new.creator_notes is distinct from old.creator_notes or new.application_reference is distinct from old.application_reference or new.submitted_at is distinct from old.submitted_at then raise exception 'Submission progress is managed by your partner'; end if;
   if new.status is distinct from old.status and new.status not in ('documents_pending','ready_to_apply','closed') then raise exception 'Submission progress is managed by your partner'; end if;
  end if;
 end if;
 return new;
end $$;
create trigger rk_assistance_case_guard before insert or update on public.creator_assistance_cases for each row execute function public.rk_guard_assistance_case();
revoke all on function public.rk_guard_assistance_case() from public,anon,authenticated;

create or replace function public.rk_can_access_assistance(p_case_id uuid,p_manage boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.can_manage_growth() or exists(
  select 1 from public.creator_assistance_cases c join public.creator_partners cp on cp.id=c.creator_id
  where c.id=p_case_id and (c.student_user_id=auth.uid() and not p_manage or
    (c.consent_status='granted' and c.status<>'closed' and cp.user_id=auth.uid() and cp.status='active'))
 ))
$$;
revoke all on function public.rk_can_access_assistance(uuid,boolean) from public,anon;
grant execute on function public.rk_can_access_assistance(uuid,boolean) to authenticated;

-- Every document row points to the student's consented case path.
create or replace function public.rk_guard_assistance_document() returns trigger language plpgsql set search_path='' as $$
begin
 if split_part(new.file_path,'/',1)<>new.user_id::text or split_part(new.file_path,'/',2)<>new.case_id::text
 or not exists(select 1 from public.creator_assistance_cases c where c.id=new.case_id and c.student_user_id=new.user_id and c.consent_status='granted' and c.status<>'closed')
 then raise exception 'Document must belong to this active, consented student case'; end if;
 return new;
end $$;
create trigger rk_assistance_document_path_guard before insert or update on public.application_assistance_documents for each row execute function public.rk_guard_assistance_document();
revoke all on function public.rk_guard_assistance_document() from public,anon,authenticated;
create policy "partner uploads assigned assistance documents" on public.application_assistance_documents for insert to authenticated with check(public.rk_can_access_assistance(case_id,true));
create policy "partner deletes assigned assistance document versions" on public.application_assistance_documents for delete to authenticated using(public.rk_can_access_assistance(case_id,true));
create or replace function public.rk_can_write_assistance_file(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.creator_assistance_cases c where c.id::text=split_part(p_name,'/',2)
 and c.student_user_id::text=split_part(p_name,'/',1) and c.consent_status='granted' and c.status<>'closed'
 and public.rk_can_access_assistance(c.id,true))
$$;
revoke all on function public.rk_can_write_assistance_file(text) from public,anon;
grant execute on function public.rk_can_write_assistance_file(text) to authenticated;
create policy "partner upload consented assistance file" on storage.objects for insert to authenticated with check(bucket_id='application-documents' and public.rk_can_write_assistance_file(name));
create policy "partner remove consented assistance file" on storage.objects for delete to authenticated using(bucket_id='application-documents' and public.rk_can_write_assistance_file(name));

create table public.assistance_submissions (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references public.creator_assistance_cases(id) on delete cascade,
 institution text not null check(length(btrim(institution)) between 2 and 200), programme text not null check(length(btrim(programme)) between 2 and 250),
 institution_type text not null default 'university' check(institution_type in ('university','tvet','private','other')),
 status text not null default 'preparing' check(status in ('preparing','documents_required','submitted','awaiting_response','accepted','rejected','withdrawn')),
 reference text not null default '', official_url text not null default '', deadline date, submitted_at timestamptz,
 notes text not null default '' check(length(notes)<=5000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status not in ('submitted','awaiting_response','accepted','rejected') or (length(btrim(reference))>0 and submitted_at is not null)),
 check(official_url='' or official_url ~ '^https://')
);
create index assistance_submissions_case_idx on public.assistance_submissions(case_id);
alter table public.assistance_submissions enable row level security;
create policy "case participants read submissions" on public.assistance_submissions for select to authenticated using(public.rk_can_access_assistance(case_id));
create policy "assigned partner manages submissions" on public.assistance_submissions for all to authenticated using(public.rk_can_access_assistance(case_id,true)) with check(public.rk_can_access_assistance(case_id,true));
grant select,insert,update,delete on public.assistance_submissions to authenticated;

create table public.assistance_document_requests (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references public.creator_assistance_cases(id) on delete cascade,
 title text not null check(length(btrim(title)) between 2 and 200), instructions text not null default '',
 status text not null default 'requested' check(status in ('requested','received','verified')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index assistance_document_requests_case_idx on public.assistance_document_requests(case_id);
alter table public.assistance_document_requests enable row level security;
create policy "participants read document requests" on public.assistance_document_requests for select to authenticated using(public.rk_can_access_assistance(case_id));
create policy "partner manages document checklist" on public.assistance_document_requests for all to authenticated using(public.rk_can_access_assistance(case_id,true)) with check(public.rk_can_access_assistance(case_id,true));
grant select,insert,update,delete on public.assistance_document_requests to authenticated;

create table public.assistance_call_requests (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references public.creator_assistance_cases(id) on delete cascade,
 requested_by uuid not null default auth.uid() references auth.users(id),
 preferred_at timestamptz not null, phone text not null check(public.rk_normalize_phone(phone) is not null),
 topic text not null check(length(btrim(topic)) between 3 and 1000),
 status text not null default 'requested' check(status in ('requested','scheduled','completed','cancelled')),
 scheduled_at timestamptz, meeting_url text not null default '' check(meeting_url='' or meeting_url ~ '^https://'),
 staff_notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index assistance_call_requests_case_idx on public.assistance_call_requests(case_id);
create index assistance_call_requests_user_idx on public.assistance_call_requests(requested_by);
create unique index assistance_one_open_call_idx on public.assistance_call_requests(case_id) where status in ('requested','scheduled');
alter table public.assistance_call_requests enable row level security;
create policy "participants see call requests" on public.assistance_call_requests for select to authenticated using(public.rk_can_access_assistance(case_id));
create policy "participants request assistance calls" on public.assistance_call_requests for insert to authenticated with check(public.rk_can_access_assistance(case_id) and requested_by=(select auth.uid()) and status='requested' and preferred_at>now() and scheduled_at is null and meeting_url='');
create policy "partners manage assistance calls" on public.assistance_call_requests for update to authenticated using(public.rk_can_access_assistance(case_id,true)) with check(public.rk_can_access_assistance(case_id,true));
grant select,insert,update on public.assistance_call_requests to authenticated;

create table public.assistance_case_activity (
 id bigint generated always as identity primary key, case_id uuid not null references public.creator_assistance_cases(id) on delete cascade,
 actor_id uuid, event_type text not null, detail jsonb not null default '{}', created_at timestamptz not null default now()
);
create index assistance_case_activity_case_idx on public.assistance_case_activity(case_id,created_at desc);
alter table public.assistance_case_activity enable row level security;
create policy "participants read case history" on public.assistance_case_activity for select to authenticated using(public.rk_can_access_assistance(case_id));
grant select on public.assistance_case_activity to authenticated;
create or replace function public.rk_log_assistance_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare v_case uuid;
begin
 if tg_table_name='creator_assistance_cases' then v_case:=new.id; else v_case:=new.case_id; end if;
 insert into public.assistance_case_activity(case_id,actor_id,event_type,detail) values(v_case,auth.uid(),tg_table_name||'.'||lower(tg_op),
 jsonb_build_object('status',to_jsonb(new)->>'status','record_id',to_jsonb(new)->>'id'));
 return new;
end $$;
create trigger rk_case_activity after insert or update on public.creator_assistance_cases for each row execute function public.rk_log_assistance_activity();
create trigger rk_submission_activity after insert or update on public.assistance_submissions for each row execute function public.rk_log_assistance_activity();
create trigger rk_call_activity after insert or update on public.assistance_call_requests for each row execute function public.rk_log_assistance_activity();
create trigger rk_document_activity after insert on public.application_assistance_documents for each row execute function public.rk_log_assistance_activity();
revoke all on function public.rk_log_assistance_activity() from public,anon,authenticated;

-- Complete, paginated exports combine profiles, CRM and WhatsApp-only contacts.
create or replace function public.rk_export_contacts(p_offset integer default 0,p_limit integer default 500) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not public.adminos_is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 with sources as (
  select 'profile:'||p.id as key,p.id as user_id,p.full_name,p.email,coalesce(nullif(p.phone_e164,''),nullif(p.phone,''),p.phone_number) phone,p.campus,p.course,'Platform user' source from public.profiles p
  union all select 'contact:'||c.id,c.profile_user_id,c.full_name,c.email,c.phone,c.campus,null,'CRM / WhatsApp' from public.adminos_contacts c where c.merged_into_id is null
  union all select 'whatsapp:'||t.id,c.profile_user_id,coalesce(c.full_name,t.metadata->>'profile_name'),c.email,t.channel_address,c.campus,null,'WhatsApp' from public.adminos_whatsapp_threads t left join public.adminos_contacts c on c.id=t.contact_id
 ), normalized as (
  select *,coalesce(public.rk_normalize_phone(phone),nullif(lower(email),''),key) identity from sources
 ), merged as (
  select identity,max(user_id::text)::uuid user_id,
    coalesce(max(nullif(btrim(full_name),'')),max(public.rk_normalize_phone(phone)),max(email),'Student') full_name,
    max(nullif(email,'')) email,max(public.rk_normalize_phone(phone)) phone,max(nullif(campus,'')) campus,max(nullif(course,'')) course,
    string_agg(distinct source,', ' order by source) sources
  from normalized group by identity
 ), enriched as (
  select m.*,coalesce(r.name,wr.name,w.preferred_residence) preferred_residence,
    coalesce(a.funding_type,w.funding_type,l.funding) funding_type,coalesce(a.academic_year,w.academic_year,l.academic_year) academic_year,
    case when public.rk_student_is_placed(m.user_id,m.phone) then 'Placed for follow-ups' else coalesce(a.status,l.stage,'Enquiry') end placement_status
  from merged m
  left join lateral (select residence_id,funding_type,academic_year,status from public.applications where user_id=m.user_id order by created_at desc limit 1)a on true
  left join public.residences r on r.id=a.residence_id
  left join lateral (select cl.selected_residence_id,cl.funding,cl.academic_year,cl.stage from public.adminos_whatsapp_conversion_leads cl
    join public.adminos_whatsapp_threads t on t.id=cl.thread_id
    where cl.user_id=m.user_id or public.rk_normalize_phone(t.channel_address)=m.phone order by cl.updated_at desc limit 1)l on true
  left join public.residences wr on wr.id=l.selected_residence_id
  left join lateral (select preferred_residence,funding_type,academic_year from public.single_room_waitlist where user_id=m.user_id order by created_at desc limit 1)w on true
 ) select jsonb_build_object('total',(select count(*) from enriched),'rows',coalesce((select jsonb_agg(to_jsonb(e) order by e.identity) from
   (select * from enriched order by identity offset greatest(p_offset,0) limit greatest(1,least(p_limit,500)))e),'[]'::jsonb)) into v_result;
 return v_result;
end $$;
revoke all on function public.rk_export_contacts(integer,integer) from public,anon;
grant execute on function public.rk_export_contacts(integer,integer) to authenticated;
revoke truncate,references,trigger on public.creator_partners,public.creator_assistance_cases,public.application_assistance_documents from anon,authenticated;
grant all on public.residence_feedback_campaigns,public.residence_stay_feedback,public.single_room_waitlist,
 public.assistance_submissions,public.assistance_document_requests,public.assistance_call_requests,public.assistance_case_activity to service_role;
grant usage,select on sequence public.assistance_case_activity_id_seq to service_role;


