-- Dimpho sales/service conversion engine.
-- Deterministic first: conversion tracking, follow-ups and bulk landlord outreach do not use AI.

create table if not exists public.adminos_whatsapp_conversion_leads (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null unique references public.adminos_whatsapp_threads(id) on delete cascade,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  user_id uuid,
  intent text,
  stage text not null default 'new',
  campus text,
  institution text,
  funding text,
  academic_year integer,
  tenant_type text,
  room_preference text,
  budget_min numeric,
  budget_max numeric,
  selected_residence_id uuid references public.residences(id) on delete set null,
  source text not null default 'whatsapp',
  first_inbound_at timestamptz not null default now(),
  last_inbound_at timestamptz not null default now(),
  last_conversion_action_at timestamptz,
  next_follow_up_at timestamptz,
  follow_up_count integer not null default 0,
  converted_at timestamptz,
  closed_at timestamptz,
  close_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_adminos_conversion_leads_followup on public.adminos_whatsapp_conversion_leads(next_follow_up_at) where converted_at is null and closed_at is null;
create index if not exists idx_adminos_conversion_leads_stage on public.adminos_whatsapp_conversion_leads(stage,updated_at desc);
create index if not exists idx_adminos_conversion_leads_contact on public.adminos_whatsapp_conversion_leads(contact_id,updated_at desc);
alter table public.adminos_whatsapp_conversion_leads enable row level security;
drop policy if exists "AdminOS staff read conversion leads" on public.adminos_whatsapp_conversion_leads;
create policy "AdminOS staff read conversion leads" on public.adminos_whatsapp_conversion_leads for select to authenticated using ((select public.adminos_is_staff()));
drop policy if exists "AdminOS staff manage conversion leads" on public.adminos_whatsapp_conversion_leads;
create policy "AdminOS staff manage conversion leads" on public.adminos_whatsapp_conversion_leads for all to authenticated using ((select public.adminos_is_staff())) with check ((select public.adminos_is_staff()));
revoke all on public.adminos_whatsapp_conversion_leads from anon;
grant select,insert,update on public.adminos_whatsapp_conversion_leads to authenticated;

create table if not exists public.adminos_landlord_outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  campaign_type text not null default 'proposal' check (campaign_type in ('prospecting','proposal','follow_up','partnership')),
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  status text not null default 'draft' check (status in ('draft','queued','sending','paused','completed','cancelled')),
  template_key text not null default 'rk_landlord_outreach_v1',
  message text not null,
  scheduled_at timestamptz,
  created_by uuid,
  recipient_count integer not null default 0,
  eligible_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_adminos_landlord_campaigns_status on public.adminos_landlord_outreach_campaigns(status,created_at desc);
alter table public.adminos_landlord_outreach_campaigns enable row level security;
drop policy if exists "AdminOS staff manage landlord outreach campaigns" on public.adminos_landlord_outreach_campaigns;
create policy "AdminOS staff manage landlord outreach campaigns" on public.adminos_landlord_outreach_campaigns for all to authenticated using ((select public.adminos_is_staff())) with check ((select public.adminos_is_staff()));
revoke all on public.adminos_landlord_outreach_campaigns from anon;
grant select,insert,update,delete on public.adminos_landlord_outreach_campaigns to authenticated;

create table if not exists public.adminos_landlord_outreach_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.adminos_landlord_outreach_campaigns(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  contact_name text,
  phone text,
  normalized_phone text,
  email text,
  eligible boolean not null default false,
  eligibility_reason text,
  status text not null default 'draft' check (status in ('draft','ready','queued','sent','waiting_template','blocked','failed','cancelled')),
  event_id uuid references public.adminos_whatsapp_site_events(id) on delete set null,
  twilio_message_sid text,
  sent_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id,normalized_phone)
);
create index if not exists idx_adminos_landlord_outreach_recipients_campaign on public.adminos_landlord_outreach_recipients(campaign_id,status);
alter table public.adminos_landlord_outreach_recipients enable row level security;
drop policy if exists "AdminOS staff manage landlord outreach recipients" on public.adminos_landlord_outreach_recipients;
create policy "AdminOS staff manage landlord outreach recipients" on public.adminos_landlord_outreach_recipients for all to authenticated using ((select public.adminos_is_staff())) with check ((select public.adminos_is_staff()));
revoke all on public.adminos_landlord_outreach_recipients from anon;
grant select,insert,update,delete on public.adminos_landlord_outreach_recipients to authenticated;

create or replace function public.adminos_touch_whatsapp_conversion(
  p_thread_id uuid,
  p_contact_id uuid default null,
  p_user_id uuid default null,
  p_intent text default null,
  p_stage text default null,
  p_patch jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_id uuid;
  v_stage text := coalesce(nullif(p_stage,''),'new');
  v_follow timestamptz;
begin
  v_follow := case v_stage
    when 'new' then now() + interval '1 hour'
    when 'qualified' then now() + interval '1 hour'
    when 'matched' then now() + interval '2 hours'
    when 'enrollment_guidance' then now() + interval '3 hours'
    when 'nsfas_guidance' then now() + interval '3 hours'
    when 'application_started' then now() + interval '4 hours'
    when 'reservation_started' then now() + interval '4 hours'
    when 'lead_created' then now() + interval '4 hours'
    when 'human_handoff' then null
    when 'converted' then null
    else now() + interval '2 hours'
  end;

  insert into public.adminos_whatsapp_conversion_leads(
    thread_id,contact_id,user_id,intent,stage,campus,institution,funding,academic_year,tenant_type,room_preference,budget_min,budget_max,selected_residence_id,last_inbound_at,last_conversion_action_at,next_follow_up_at,converted_at,metadata
  ) values (
    p_thread_id,p_contact_id,p_user_id,p_intent,v_stage,
    nullif(p_patch->>'campus',''),nullif(p_patch->>'institution',''),nullif(p_patch->>'funding',''),
    case when (p_patch->>'academic_year') ~ '^\d{4}$' then (p_patch->>'academic_year')::integer else null end,
    nullif(p_patch->>'tenant_type',''),nullif(p_patch->>'room_preference',''),
    case when (p_patch->>'budget_min') ~ '^\d+(\.\d+)?$' then (p_patch->>'budget_min')::numeric else null end,
    case when (p_patch->>'budget_max') ~ '^\d+(\.\d+)?$' then (p_patch->>'budget_max')::numeric else null end,
    case when coalesce(p_patch->>'selected_residence_id','') ~ '^[0-9a-fA-F-]{36}$' then (p_patch->>'selected_residence_id')::uuid else null end,
    now(),now(),v_follow,case when v_stage='converted' then now() else null end,p_patch
  )
  on conflict (thread_id) do update set
    contact_id=coalesce(excluded.contact_id,adminos_whatsapp_conversion_leads.contact_id),
    user_id=coalesce(excluded.user_id,adminos_whatsapp_conversion_leads.user_id),
    intent=coalesce(nullif(excluded.intent,''),adminos_whatsapp_conversion_leads.intent),
    stage=case when excluded.stage='new' and adminos_whatsapp_conversion_leads.stage<>'new' then adminos_whatsapp_conversion_leads.stage else excluded.stage end,
    campus=coalesce(excluded.campus,adminos_whatsapp_conversion_leads.campus),
    institution=coalesce(excluded.institution,adminos_whatsapp_conversion_leads.institution),
    funding=coalesce(excluded.funding,adminos_whatsapp_conversion_leads.funding),
    academic_year=coalesce(excluded.academic_year,adminos_whatsapp_conversion_leads.academic_year),
    tenant_type=coalesce(excluded.tenant_type,adminos_whatsapp_conversion_leads.tenant_type),
    room_preference=coalesce(excluded.room_preference,adminos_whatsapp_conversion_leads.room_preference),
    budget_min=coalesce(excluded.budget_min,adminos_whatsapp_conversion_leads.budget_min),
    budget_max=coalesce(excluded.budget_max,adminos_whatsapp_conversion_leads.budget_max),
    selected_residence_id=coalesce(excluded.selected_residence_id,adminos_whatsapp_conversion_leads.selected_residence_id),
    last_inbound_at=now(),last_conversion_action_at=now(),
    next_follow_up_at=case when excluded.stage in ('converted','human_handoff') then null else excluded.next_follow_up_at end,
    converted_at=coalesce(adminos_whatsapp_conversion_leads.converted_at,excluded.converted_at),
    metadata=adminos_whatsapp_conversion_leads.metadata || excluded.metadata,
    updated_at=now()
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.adminos_touch_whatsapp_conversion(uuid,uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.adminos_touch_whatsapp_conversion(uuid,uuid,uuid,text,text,jsonb) to authenticated;

create or replace function public.adminos_generate_conversion_followups() returns integer
language plpgsql security definer set search_path=public as $$
declare
  rec record;
  ev_id uuid;
  event_kind text;
  action_url text;
  generated integer := 0;
begin
  for rec in
    select l.*,c.full_name,c.phone,t.customer_window_expires_at,
           coalesce(pref.do_not_contact,false) as dnc,
           coalesce(pref.whatsapp_allowed,true) as wa_allowed,
           coalesce(pref.marketing_allowed,false) as marketing_allowed,
           r.slug as residence_slug,r.name as residence_name
    from public.adminos_whatsapp_conversion_leads l
    join public.adminos_whatsapp_threads t on t.id=l.thread_id
    left join public.adminos_contacts c on c.id=l.contact_id
    left join public.adminos_communication_preferences pref on pref.contact_id=l.contact_id
    left join public.residences r on r.id=l.selected_residence_id
    where l.converted_at is null and l.closed_at is null
      and l.follow_up_count < 3
      and l.next_follow_up_at is not null and l.next_follow_up_at <= now()
      and coalesce(pref.do_not_contact,false)=false
      and coalesce(pref.whatsapp_allowed,true)=true
      and nullif(regexp_replace(coalesce(c.phone,t.channel_address,''),'\D','','g'),'') is not null
    order by l.next_follow_up_at asc
    limit 100
  loop
    if rec.customer_window_expires_at is not null and rec.customer_window_expires_at > now() then
      event_kind := 'conversion_followup_service';
    elsif rec.stage in ('application_started','reservation_started','lead_created') then
      event_kind := 'conversion_followup_action';
    elsif rec.marketing_allowed then
      event_kind := 'conversion_followup_interest';
    else
      update public.adminos_whatsapp_conversion_leads
      set next_follow_up_at=null,metadata=metadata||jsonb_build_object('followup_paused_reason','marketing_permission_required'),updated_at=now()
      where id=rec.id;
      continue;
    end if;

    action_url := case
      when rec.selected_residence_id is not null then 'https://www.reskonnect.org/find-my-res/'||coalesce(rec.residence_slug,rec.selected_residence_id::text)
      when rec.intent='accommodation' then 'https://www.reskonnect.org/findmyres'
      when rec.intent in ('applications','enrollment','nsfas') then 'https://www.reskonnect.org/applications'
      when rec.intent='wil' then 'https://www.reskonnect.org/opportunities'
      else 'https://www.reskonnect.org'
    end;

    insert into public.adminos_whatsapp_site_events(event_type,source_table,source_id,user_id,contact_id,phone,payload,status,idempotency_key)
    values(
      event_kind,'adminos_whatsapp_conversion_leads',rec.id,rec.user_id,rec.contact_id,coalesce(rec.phone,rec.channel_address),
      jsonb_build_object(
        'user_name',coalesce(rec.full_name,'there'),'intent',rec.intent,'stage',rec.stage,'campus',rec.campus,
        'residence_name',rec.residence_name,'action_url',action_url,'follow_up_number',rec.follow_up_count+1
      ),'pending',concat('conversion-followup:',rec.id,':',rec.follow_up_count+1)
    ) on conflict (idempotency_key) do update set payload=excluded.payload,updated_at=now()
    returning id into ev_id;

    update public.adminos_whatsapp_conversion_leads
    set follow_up_count=follow_up_count+1,
        next_follow_up_at=case follow_up_count+1 when 1 then now()+interval '12 hours' when 2 then now()+interval '48 hours' else null end,
        metadata=metadata||jsonb_build_object('last_followup_event_id',ev_id,'last_followup_type',event_kind),updated_at=now()
    where id=rec.id;
    generated := generated + 1;
  end loop;
  return generated;
end; $$;
revoke all on function public.adminos_generate_conversion_followups() from public,anon;
grant execute on function public.adminos_generate_conversion_followups() to authenticated;

create or replace function public.adminos_build_landlord_campaign_recipients(p_campaign_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  total_count integer := 0;
  eligible_count integer := 0;
begin
  delete from public.adminos_landlord_outreach_recipients where campaign_id=p_campaign_id and status='draft';

  insert into public.adminos_landlord_outreach_recipients(campaign_id,source_type,source_id,contact_id,contact_name,phone,normalized_phone,email,eligible,eligibility_reason,status,metadata)
  select p_campaign_id,'adminos_contact',c.id,c.id,c.full_name,c.phone,regexp_replace(coalesce(c.phone,''),'\D','','g'),c.email,
    (coalesce(pref.whatsapp_allowed,false)=true and coalesce(pref.marketing_allowed,false)=true and coalesce(pref.do_not_contact,false)=false),
    case when coalesce(pref.do_not_contact,false) then 'do_not_contact' when coalesce(pref.whatsapp_allowed,false)=false then 'whatsapp_not_allowed' when coalesce(pref.marketing_allowed,false)=false then 'marketing_permission_required' else 'eligible' end,
    case when coalesce(pref.whatsapp_allowed,false)=true and coalesce(pref.marketing_allowed,false)=true and coalesce(pref.do_not_contact,false)=false then 'ready' else 'blocked' end,
    jsonb_build_object('contact_type',c.contact_type,'primary_source',c.primary_source)
  from public.adminos_contacts c
  left join public.adminos_communication_preferences pref on pref.contact_id=c.id
  where lower(coalesce(c.contact_type,'')) like '%landlord%'
     or lower(coalesce(c.metadata->>'persona',''))='landlord'
     or lower(coalesce(c.metadata->>'type',''))='landlord'
  on conflict (campaign_id,normalized_phone) do nothing;

  insert into public.adminos_landlord_outreach_recipients(campaign_id,source_type,source_id,contact_id,contact_name,phone,normalized_phone,email,eligible,eligibility_reason,status,metadata)
  select p_campaign_id,'landlord_application',la.id,c.id,coalesce(la.contact_name,la.company_name),la.contact_phone,regexp_replace(coalesce(la.contact_phone,''),'\D','','g'),la.contact_email,
    (c.id is not null and coalesce(pref.whatsapp_allowed,false)=true and coalesce(pref.marketing_allowed,false)=true and coalesce(pref.do_not_contact,false)=false),
    case when c.id is null then 'marketing_permission_required' when coalesce(pref.do_not_contact,false) then 'do_not_contact' when coalesce(pref.whatsapp_allowed,false)=false then 'whatsapp_not_allowed' when coalesce(pref.marketing_allowed,false)=false then 'marketing_permission_required' else 'eligible' end,
    case when c.id is not null and coalesce(pref.whatsapp_allowed,false)=true and coalesce(pref.marketing_allowed,false)=true and coalesce(pref.do_not_contact,false)=false then 'ready' else 'blocked' end,
    jsonb_build_object('property_name',la.property_name,'company_name',la.company_name,'nearest_campus',la.nearest_campus,'application_status',la.status)
  from public.landlord_applications la
  left join public.adminos_contacts c on regexp_replace(coalesce(c.phone,''),'\D','','g')=regexp_replace(coalesce(la.contact_phone,''),'\D','','g') and nullif(regexp_replace(coalesce(la.contact_phone,''),'\D','','g'),'') is not null
  left join public.adminos_communication_preferences pref on pref.contact_id=c.id
  where nullif(regexp_replace(coalesce(la.contact_phone,''),'\D','','g'),'') is not null
  on conflict (campaign_id,normalized_phone) do nothing;

  select count(*),count(*) filter (where eligible) into total_count,eligible_count from public.adminos_landlord_outreach_recipients where campaign_id=p_campaign_id;
  update public.adminos_landlord_outreach_campaigns set recipient_count=total_count,eligible_count=eligible_count,updated_at=now() where id=p_campaign_id;
  return jsonb_build_object('recipient_count',total_count,'eligible_count',eligible_count,'blocked_count',total_count-eligible_count);
end; $$;
revoke all on function public.adminos_build_landlord_campaign_recipients(uuid) from public,anon;
grant execute on function public.adminos_build_landlord_campaign_recipients(uuid) to authenticated;

create or replace function public.adminos_queue_landlord_campaign(p_campaign_id uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare rec record; ev_id uuid; queued integer:=0; campaign record;
begin
  select * into campaign from public.adminos_landlord_outreach_campaigns where id=p_campaign_id;
  if campaign.id is null then raise exception 'Campaign not found'; end if;
  for rec in select * from public.adminos_landlord_outreach_recipients where campaign_id=p_campaign_id and eligible=true and status='ready' loop
    insert into public.adminos_whatsapp_site_events(event_type,source_table,source_id,contact_id,phone,payload,status,available_at,idempotency_key)
    values('landlord_outreach','adminos_landlord_outreach_recipients',rec.id,rec.contact_id,rec.phone,
      jsonb_build_object('campaign_id',p_campaign_id,'recipient_id',rec.id,'user_name',coalesce(rec.contact_name,'there'),'campaign_name',campaign.name,'message',campaign.message,'template_key',campaign.template_key),
      'pending',coalesce(campaign.scheduled_at,now()),concat('landlord-campaign:',p_campaign_id,':',rec.id))
    on conflict (idempotency_key) do update set payload=excluded.payload,available_at=excluded.available_at,updated_at=now()
    returning id into ev_id;
    update public.adminos_landlord_outreach_recipients set event_id=ev_id,status='queued',updated_at=now() where id=rec.id;
    queued:=queued+1;
  end loop;
  update public.adminos_landlord_outreach_campaigns set status=case when queued>0 then 'queued' else status end,updated_at=now() where id=p_campaign_id;
  return queued;
end; $$;
revoke all on function public.adminos_queue_landlord_campaign(uuid) from public,anon;
grant execute on function public.adminos_queue_landlord_campaign(uuid) to authenticated;

create or replace function public.adminos_conversion_application_touch() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  update public.adminos_whatsapp_conversion_leads
  set stage='application_started',next_follow_up_at=now()+interval '4 hours',last_conversion_action_at=now(),updated_at=now()
  where user_id=new.user_id and converted_at is null and closed_at is null;
  return new;
end; $$;
drop trigger if exists trg_adminos_conversion_application_touch on public.applications;
create trigger trg_adminos_conversion_application_touch after insert on public.applications for each row execute function public.adminos_conversion_application_touch();

create or replace function public.adminos_conversion_reservation_touch() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  update public.adminos_whatsapp_conversion_leads
  set stage=case when new.status='confirmed' then 'converted' else 'reservation_started' end,
      selected_residence_id=coalesce(new.residence_id,selected_residence_id),
      converted_at=case when new.status='confirmed' then coalesce(converted_at,now()) else converted_at end,
      next_follow_up_at=case when new.status='confirmed' then null else now()+interval '4 hours' end,
      last_conversion_action_at=now(),updated_at=now()
  where user_id=new.user_id and converted_at is null and closed_at is null;
  return new;
end; $$;
drop trigger if exists trg_adminos_conversion_reservation_touch on public.accommodation_reservations;
create trigger trg_adminos_conversion_reservation_touch after insert or update of status on public.accommodation_reservations for each row execute function public.adminos_conversion_reservation_touch();

insert into public.adminos_whatsapp_rich_content(content_key,display_name,content_type,approval_required,status,purpose,config,metadata)
values
('rk_conversion_followup_action_v1','Dimpho incomplete-action follow-up','twilio/text',true,'not_created','transactional',
 jsonb_build_object('body','Hi {{1}}, you started {{2}} with ResKonnect and there is still a next step waiting. Continue here: {{3}}. Reply HELP if you want Dimpho to guide you.'),jsonb_build_object('persona','Dimpho','category','UTILITY')),
('rk_conversion_followup_interest_v1','Dimpho interest follow-up','twilio/text',true,'not_created','marketing',
 jsonb_build_object('body','Hi {{1}}, Dimpho from ResKonnect here. You recently asked us about {{2}}. If you still want help moving forward, continue here: {{3}} or reply STOP to opt out.'),jsonb_build_object('persona','Dimpho','category','MARKETING')),
('rk_landlord_outreach_v1','ResKonnect landlord partnership outreach','twilio/text',true,'not_created','marketing',
 jsonb_build_object('body','Hi {{1}}, ResKonnect would like to discuss a student accommodation partnership. {{2}} If this is relevant, reply YES and our partnerships team will assist. Reply STOP to opt out.'),jsonb_build_object('persona','ResKonnect','category','MARKETING'))
on conflict (content_key) do update set display_name=excluded.display_name,content_type=excluded.content_type,approval_required=excluded.approval_required,purpose=excluded.purpose,config=excluded.config,metadata=excluded.metadata,status='not_created',content_sid=null,updated_at=now();

update public.adminos_agent_prompt_versions set active=false where agent_key='konnect_agent' and active=true;
insert into public.adminos_agent_prompt_versions(agent_key,version,name,system_prompt,policy,tool_allowlist,active)
values(
  'konnect_agent',5,'Dimpho Conversion Concierge',
  'You are Dimpho, ResKonnect''s premium service and conversion assistant. Your job is to resolve the user''s actual request and move every legitimate enquiry toward a useful next action without being repetitive, pushy or misleading. Use verified context only. Do not resend menus or repeat a previous action unless the user explicitly asks for the menu or the earlier action failed. Preserve conversation history and treat short replies as answers to the immediately preceding question. For accommodation, qualify campus/location, academic year, funding, room preference and budget only when those facts are genuinely needed; then move to a shortlist, a selected residence, an application/reservation/lead, or a clear next step. Never recommend residences from the wrong campus as if they match. Residences without images are still valid options when their published data matches; state only verified facts. For university/TVET/private-college enrolment, guide readiness and ResKonnect application support, but never claim to be the institution or guarantee admission. ResKonnect does not submit NSFAS funding applications; for NSFAS, provide official-process guidance and use ResKonnect for accommodation/readiness support without implying NSFAS approval. For WIL, partnerships and service enquiries, identify the concrete goal and move it forward. Ask at most one concise clarifying question at a time. End with one best next action, not a menu plus multiple competing CTAs. Never invent application or reservation status, availability, prices, deadlines, approvals, funding outcomes, partner commitments, payment results or legal terms. Never request passwords, OTPs, banking credentials, identity numbers or sensitive documents in open WhatsApp. Use the preferred language supplied in context without a second translation call. Escalate protected, safety, scam, legal, financial or owner-level binding decisions, but always acknowledge the user. All ResKonnect links must use https://www.reskonnect.org. Return JSON only with keys answer, confidence, risk, escalate, reason. risk must be green, amber or red.',
  jsonb_build_object('release',6,'persona','Dimpho','authority','green','deterministic_first',true,'minimise_ai_calls',true,'conversion_focused',true,'no_duplicate_actions',true,'single_best_next_action',true,'campus_accuracy_required',true,'multilingual_single_call',true,'verified_data_only',true,'popia_minimisation',true),
  jsonb_build_array('read_contact','read_application','read_residence','read_knowledge','draft_reply','request_human_review'),true
)
on conflict (agent_key,version) do update set name=excluded.name,system_prompt=excluded.system_prompt,policy=excluded.policy,tool_allowlist=excluded.tool_allowlist,active=true;

select public.adminos_generate_conversion_followups();
do $$ begin if exists(select 1 from cron.job where jobname='adminos-conversion-followups') then perform cron.unschedule('adminos-conversion-followups'); end if; end $$;
select cron.schedule('adminos-conversion-followups','*/10 * * * *',$job$ select public.adminos_generate_conversion_followups(); $job$);
