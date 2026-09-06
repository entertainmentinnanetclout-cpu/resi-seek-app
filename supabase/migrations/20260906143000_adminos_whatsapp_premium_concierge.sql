-- AdminOS WhatsApp Premium Concierge
-- Rich interactive journeys, transactional site-event queue, conversation state and automated notifications.

alter table public.adminos_whatsapp_threads
  add column if not exists conversation_state jsonb not null default '{}'::jsonb,
  add column if not exists intent text,
  add column if not exists last_menu_key text,
  add column if not exists last_menu_at timestamptz;

create table if not exists public.adminos_whatsapp_rich_content (
  id uuid primary key default gen_random_uuid(),
  content_key text not null unique,
  display_name text not null,
  content_type text not null,
  content_sid text,
  approval_required boolean not null default false,
  status text not null default 'not_created',
  purpose text not null default 'service',
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adminos_whatsapp_rich_content_status_check check (status in ('not_created','created','pending_approval','approved','rejected','provider_error','disabled'))
);

create table if not exists public.adminos_whatsapp_journeys (
  id uuid primary key default gen_random_uuid(),
  journey_key text not null unique,
  display_name text not null,
  description text,
  trigger_terms text[] not null default '{}',
  entry_content_key text references public.adminos_whatsapp_rich_content(content_key) on delete set null,
  enabled boolean not null default true,
  escalation_required boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adminos_whatsapp_site_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  source_table text not null,
  source_id uuid,
  user_id uuid,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  phone text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adminos_whatsapp_site_events_status_check check (status in ('pending','processing','sent','waiting_template','blocked','failed','cancelled'))
);

create index if not exists idx_adminos_whatsapp_site_events_due on public.adminos_whatsapp_site_events(status,available_at,created_at);
create index if not exists idx_adminos_whatsapp_site_events_user on public.adminos_whatsapp_site_events(user_id,created_at desc);

alter table public.adminos_whatsapp_rich_content enable row level security;
alter table public.adminos_whatsapp_journeys enable row level security;
alter table public.adminos_whatsapp_site_events enable row level security;

drop policy if exists "AdminOS staff read rich content" on public.adminos_whatsapp_rich_content;
create policy "AdminOS staff read rich content" on public.adminos_whatsapp_rich_content for select to authenticated using ((select public.adminos_is_staff()));
drop policy if exists "AdminOS staff read journeys" on public.adminos_whatsapp_journeys;
create policy "AdminOS staff read journeys" on public.adminos_whatsapp_journeys for select to authenticated using ((select public.adminos_is_staff()));
drop policy if exists "AdminOS staff read site events" on public.adminos_whatsapp_site_events;
create policy "AdminOS staff read site events" on public.adminos_whatsapp_site_events for select to authenticated using ((select public.adminos_is_staff()));

revoke all on public.adminos_whatsapp_rich_content, public.adminos_whatsapp_journeys, public.adminos_whatsapp_site_events from anon;
grant select on public.adminos_whatsapp_rich_content, public.adminos_whatsapp_journeys, public.adminos_whatsapp_site_events to authenticated;

insert into public.adminos_whatsapp_rich_content(content_key,display_name,content_type,approval_required,purpose,config)
values
('rk_main_menu','ResKonnect main menu','twilio/list-picker',false,'service',jsonb_build_object('body','Hi {{1}}. Thanks for contacting ResKonnect. How can we help you today?','button','Choose an option','items',jsonb_build_array(
  jsonb_build_object('item','Accommodation','id','menu:accommodation','description','Find, apply, reserve or track accommodation'),
  jsonb_build_object('item','Application status','id','menu:applications','description','Track an application or missing documents'),
  jsonb_build_object('item','Reservations','id','menu:reservations','description','Manage an accommodation reservation'),
  jsonb_build_object('item','WIL & Opportunities','id','menu:opportunities','description','Work-integrated learning and opportunities'),
  jsonb_build_object('item','Partnerships','id','menu:partnerships','description','Partner, residence or business enquiries'),
  jsonb_build_object('item','App / Website support','id','menu:technical','description','Report a technical or account issue'),
  jsonb_build_object('item','Other services','id','menu:other','description','General ResKonnect assistance'),
  jsonb_build_object('item','Speak to a human','id','menu:human','description','Escalate to the ResKonnect team')
))),
('rk_accommodation_menu','Accommodation concierge','twilio/list-picker',false,'service',jsonb_build_object('body','Let us narrow this down so we show you the right accommodation.','button','Accommodation options','items',jsonb_build_array(
  jsonb_build_object('item','Find accommodation','id','acc:find','description','Get matched to suitable residences'),
  jsonb_build_object('item','2026 accommodation','id','acc:year:2026','description','Availability and applications for 2026'),
  jsonb_build_object('item','2027 accommodation','id','acc:year:2027','description','Reservations and availability for 2027'),
  jsonb_build_object('item','TUT accommodation','id','acc:institution:tut','description','TUT-focused accommodation options'),
  jsonb_build_object('item','College / TVET','id','acc:institution:tvet','description','TVET and college accommodation'),
  jsonb_build_object('item','NSFAS funded','id','acc:funding:nsfas','description','Residences accepting NSFAS'),
  jsonb_build_object('item','Private funded','id','acc:funding:private','description','Privately funded student options'),
  jsonb_build_object('item','Private tenant','id','acc:tenant:private','description','Non-student/private tenant options'),
  jsonb_build_object('item','My application','id','menu:applications','description','Track an existing accommodation application'),
  jsonb_build_object('item','Main menu','id','menu:main','description','Return to all ResKonnect services')
))),
('rk_year_menu','Accommodation year','twilio/quick-reply',false,'service',jsonb_build_object('body','Which academic year are you looking for?','actions',jsonb_build_array(
 jsonb_build_object('type','QUICK_REPLY','title','2026','id','acc:year:2026'),jsonb_build_object('type','QUICK_REPLY','title','2027','id','acc:year:2027'),jsonb_build_object('type','QUICK_REPLY','title','Not sure','id','acc:year:unsure')))),
('rk_funding_menu','Funding type','twilio/list-picker',false,'service',jsonb_build_object('body','How will the accommodation be funded?','button','Choose funding','items',jsonb_build_array(
 jsonb_build_object('item','NSFAS','id','acc:funding:nsfas','description','NSFAS-funded accommodation'),jsonb_build_object('item','Bursary','id','acc:funding:bursary','description','Bursary or sponsor funding'),jsonb_build_object('item','Private / Self-funded','id','acc:funding:private','description','Self-funded accommodation'),jsonb_build_object('item','Not sure yet','id','acc:funding:unsure','description','Show suitable options and guidance')))),
('rk_tenant_menu','Tenant type','twilio/quick-reply',false,'service',jsonb_build_object('body','Who is the accommodation for?','actions',jsonb_build_array(
 jsonb_build_object('type','QUICK_REPLY','title','Student','id','acc:tenant:student'),jsonb_build_object('type','QUICK_REPLY','title','Private tenant','id','acc:tenant:private'),jsonb_build_object('type','QUICK_REPLY','title','Parent / guardian','id','acc:tenant:guardian')))),
('rk_application_menu','Application concierge','twilio/list-picker',false,'service',jsonb_build_object('body','What would you like to do with your application?','button','Application options','items',jsonb_build_array(
 jsonb_build_object('item','Check status','id','app:status','description','See your latest application status'),jsonb_build_object('item','Missing documents','id','app:missing','description','See documents still needed or rejected'),jsonb_build_object('item','Upload documents','id','app:upload','description','Open ResKonnect to upload required documents'),jsonb_build_object('item','Accommodation details','id','app:residence','description','View the residence linked to your application'),jsonb_build_object('item','Need help','id','app:help','description','Get guided application support'),jsonb_build_object('item','Main menu','id','menu:main','description','Return to all services')))),
('rk_opportunity_menu','WIL and opportunities','twilio/list-picker',false,'service',jsonb_build_object('body','Choose what you need help with.','button','Opportunity options','items',jsonb_build_array(
 jsonb_build_object('item','WIL application','id','wil:status','description','Check a WIL application'),jsonb_build_object('item','WIL documents','id','wil:documents','description','Document and next-step support'),jsonb_build_object('item','Available opportunities','id','wil:opportunities','description','Explore current ResKonnect opportunities'),jsonb_build_object('item','Placement support','id','wil:placement','description','Guidance about workplace placement'),jsonb_build_object('item','Speak to team','id','menu:human','description','Escalate an opportunity enquiry')))),
('rk_support_menu','Support menu','twilio/quick-reply',false,'service',jsonb_build_object('body','We can help with your ResKonnect account or platform issue.','actions',jsonb_build_array(
 jsonb_build_object('type','QUICK_REPLY','title','Login / account','id','support:account'),jsonb_build_object('type','QUICK_REPLY','title','App issue','id','support:technical'),jsonb_build_object('type','QUICK_REPLY','title','Human support','id','menu:human')))),
('rk_handoff_menu','Human handoff','twilio/quick-reply',false,'service',jsonb_build_object('body','I have escalated this to the ResKonnect team. You can wait for a human assistant or continue using the automated concierge while they review it.','actions',jsonb_build_array(
 jsonb_build_object('type','QUICK_REPLY','title','Continue menu','id','menu:main'),jsonb_build_object('type','QUICK_REPLY','title','Wait for human','id','human:wait')))),
('rk_application_confirmation','Application confirmation','twilio/quick-reply',true,'transactional',jsonb_build_object('body','Hi {{1}}, ResKonnect has received your accommodation application for {{2}}. We will keep you updated here.','actions',jsonb_build_array(
 jsonb_build_object('type','QUICK_REPLY','title','Track application','id','app:status'),jsonb_build_object('type','QUICK_REPLY','title','Missing documents','id','app:missing'),jsonb_build_object('type','QUICK_REPLY','title','Need help','id','app:help')))),
('rk_reservation_confirmation','Reservation confirmation','twilio/quick-reply',true,'transactional',jsonb_build_object('body','Hi {{1}}, your ResKonnect reservation enquiry for {{2}} has been received. We will update you here as it progresses.','actions',jsonb_build_array(
 jsonb_build_object('type','QUICK_REPLY','title','Reservation status','id','reservation:status'),jsonb_build_object('type','QUICK_REPLY','title','View options','id','menu:accommodation'),jsonb_build_object('type','QUICK_REPLY','title','Need help','id','menu:human')))),
('rk_missing_documents','Missing documents notice','twilio/quick-reply',true,'transactional',jsonb_build_object('body','Hi {{1}}, your ResKonnect application needs attention because a required document is missing or could not be verified. Open your application to continue.','actions',jsonb_build_array(
 jsonb_build_object('type','QUICK_REPLY','title','What is missing?','id','app:missing'),jsonb_build_object('type','QUICK_REPLY','title','Upload documents','id','app:upload'),jsonb_build_object('type','QUICK_REPLY','title','Get help','id','app:help')))),
('rk_wil_confirmation','WIL confirmation','twilio/quick-reply',true,'transactional',jsonb_build_object('body','Hi {{1}}, ResKonnect has received your WIL application. We will keep you updated on documents, next steps and placement progress here.','actions',jsonb_build_array(
 jsonb_build_object('type','QUICK_REPLY','title','Check WIL status','id','wil:status'),jsonb_build_object('type','QUICK_REPLY','title','WIL documents','id','wil:documents'),jsonb_build_object('type','QUICK_REPLY','title','Need help','id','menu:human')))),
('rk_support_confirmation','Support request confirmation','twilio/quick-reply',true,'transactional',jsonb_build_object('body','Hi {{1}}, ResKonnect has received your support request. You can continue with guided help here or wait for a human assistant if needed.','actions',jsonb_build_array(
 jsonb_build_object('type','QUICK_REPLY','title','Guided help','id','menu:technical'),jsonb_build_object('type','QUICK_REPLY','title','Main menu','id','menu:main'),jsonb_build_object('type','QUICK_REPLY','title','Human assistant','id','menu:human')))),
('rk_status_update','Status update','twilio/quick-reply',true,'transactional',jsonb_build_object('body','Hi {{1}}, there is an update on your ResKonnect {{2}}: {{3}}.','actions',jsonb_build_array(
 jsonb_build_object('type','QUICK_REPLY','title','View status','id','app:status'),jsonb_build_object('type','QUICK_REPLY','title','Need help','id','app:help'))))
on conflict (content_key) do update set display_name=excluded.display_name,content_type=excluded.content_type,approval_required=excluded.approval_required,purpose=excluded.purpose,config=excluded.config,updated_at=now();

insert into public.adminos_whatsapp_journeys(journey_key,display_name,description,trigger_terms,entry_content_key,escalation_required,config)
values
('main','Main concierge','Universal entry point',array['hi','hello','hey','menu','start','help'],'rk_main_menu',false,'{}'),
('accommodation','Accommodation','Accommodation discovery, applications, reservations and funding',array['accommodation','res','residence','room','rent','nsfas','2026','2027','tut accommodation','college accommodation','tvet accommodation'],'rk_accommodation_menu',false,jsonb_build_object('coverage_target',0.99)),
('applications','Applications','Status, documents and application help',array['application','apply','status','documents','missing documents','proof of registration'],'rk_application_menu',false,'{}'),
('opportunities','WIL & opportunities','WIL application, documents and placements',array['wil','work integrated learning','internship','placement','opportunity'],'rk_opportunity_menu',false,'{}'),
('technical','App / website support','Account, login and technical support',array['app issue','website issue','login','password','error','not working','bug'],'rk_support_menu',false,'{}'),
('partnerships','Partnerships','Partner, landlord, residence and business opportunities',array['partnership','partner','landlord','residence owner','business proposal','collaboration','sponsor'],'rk_handoff_menu',true,'{}'),
('human','Human escalation','Owner/admin/human escalation',array['human','agent','owner','manager','director','speak to someone'],'rk_handoff_menu',true,'{}')
on conflict (journey_key) do update set display_name=excluded.display_name,description=excluded.description,trigger_terms=excluded.trigger_terms,entry_content_key=excluded.entry_content_key,escalation_required=excluded.escalation_required,config=excluded.config,updated_at=now();

-- Scheduler secret for the event worker. Value never leaves the database.
insert into public.adminos_scheduler_secrets(secret_key,secret_value)
select 'whatsapp_event_worker', encode(gen_random_bytes(32),'hex')
where not exists (select 1 from public.adminos_scheduler_secrets where secret_key='whatsapp_event_worker');

create or replace function public.adminos_enqueue_whatsapp_site_event(
  p_event_type text,
  p_source_table text,
  p_source_id uuid,
  p_user_id uuid,
  p_phone text,
  p_payload jsonb,
  p_idempotency_suffix text default 'v1'
) returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.adminos_whatsapp_site_events(event_type,source_table,source_id,user_id,phone,payload,idempotency_key)
  values(p_event_type,p_source_table,p_source_id,p_user_id,p_phone,coalesce(p_payload,'{}'::jsonb),concat(p_source_table,':',coalesce(p_source_id::text,'none'),':',p_event_type,':',p_idempotency_suffix))
  on conflict (idempotency_key) do nothing;
end; $$;
revoke all on function public.adminos_enqueue_whatsapp_site_event(text,text,uuid,uuid,text,jsonb,text) from public,anon,authenticated;

create or replace function public.adminos_application_whatsapp_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype; r public.residences%rowtype; evt text; suffix text;
begin
  select * into p from public.profiles where id=new.user_id;
  select * into r from public.residences where id=new.residence_id;
  if tg_op='INSERT' then evt:='application_created'; suffix:='created';
  elsif new.status is distinct from old.status then evt:='application_status_changed'; suffix:=coalesce(new.status,'unknown');
  else return new; end if;
  perform public.adminos_enqueue_whatsapp_site_event(evt,'applications',new.id,new.user_id,coalesce(p.phone,p.phone_number),jsonb_build_object('application_id',new.id,'status',new.status,'funding_type',new.funding_type,'residence_id',new.residence_id,'residence_name',r.name,'residence_image',coalesce(r.cover_image_url,r.image_url),'residence_slug',r.slug,'user_name',p.full_name),suffix);
  return new;
end; $$;

drop trigger if exists trg_adminos_application_whatsapp on public.applications;
create trigger trg_adminos_application_whatsapp after insert or update of status on public.applications for each row execute function public.adminos_application_whatsapp_trigger();

create or replace function public.adminos_reservation_whatsapp_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype; r public.residences%rowtype; evt text; suffix text;
begin
  select * into p from public.profiles where id=new.user_id;
  select * into r from public.residences where id=new.residence_id;
  if tg_op='INSERT' then evt:='reservation_created'; suffix:='created';
  elsif new.status is distinct from old.status then evt:='reservation_status_changed'; suffix:=coalesce(new.status,'unknown');
  else return new; end if;
  perform public.adminos_enqueue_whatsapp_site_event(evt,'accommodation_reservations',new.id,new.user_id,coalesce(p.phone,p.phone_number),jsonb_build_object('reservation_id',new.id,'status',new.status,'academic_year',new.academic_year,'funding_type',new.funding_type,'residence_id',new.residence_id,'residence_name',r.name,'residence_image',coalesce(r.cover_image_url,r.image_url),'residence_slug',r.slug,'user_name',coalesce(new.applicant_name,p.full_name)),suffix);
  return new;
end; $$;

drop trigger if exists trg_adminos_reservation_whatsapp on public.accommodation_reservations;
create trigger trg_adminos_reservation_whatsapp after insert or update of status on public.accommodation_reservations for each row execute function public.adminos_reservation_whatsapp_trigger();

create or replace function public.adminos_document_whatsapp_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare a public.applications%rowtype; p public.profiles%rowtype; evt text; suffix text;
begin
  select * into a from public.applications where id=new.application_id;
  if a.id is null then return new; end if;
  select * into p from public.profiles where id=a.user_id;
  if tg_op='INSERT' then evt:='document_uploaded'; suffix:=concat('uploaded:',new.doc_type);
  elsif new.status is distinct from old.status and lower(coalesce(new.status,'')) in ('rejected','missing','invalid','needs_action') then evt:='document_attention'; suffix:=concat(new.doc_type,':',new.status);
  else return new; end if;
  perform public.adminos_enqueue_whatsapp_site_event(evt,'application_documents',new.id,a.user_id,coalesce(p.phone,p.phone_number),jsonb_build_object('application_id',a.id,'document_id',new.id,'doc_type',new.doc_type,'document_status',new.status,'rejection_reason',new.rejection_reason,'user_name',p.full_name),suffix);
  return new;
end; $$;

drop trigger if exists trg_adminos_document_whatsapp on public.application_documents;
create trigger trg_adminos_document_whatsapp after insert or update of status on public.application_documents for each row execute function public.adminos_document_whatsapp_trigger();

create or replace function public.adminos_wil_whatsapp_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype; evt text; suffix text;
begin
  select * into p from public.profiles where id=new.student_id;
  if tg_op='INSERT' then evt:='wil_application_created'; suffix:='created';
  elsif new.status is distinct from old.status then evt:='wil_status_changed'; suffix:=coalesce(new.status,'unknown');
  else return new; end if;
  perform public.adminos_enqueue_whatsapp_site_event(evt,'wil_applications',new.id,new.student_id,coalesce(p.phone,p.phone_number),jsonb_build_object('wil_application_id',new.id,'status',new.status,'course',new.course,'campus',new.campus,'user_name',coalesce(new.full_name,p.full_name)),suffix);
  return new;
end; $$;

drop trigger if exists trg_adminos_wil_whatsapp on public.wil_applications;
create trigger trg_adminos_wil_whatsapp after insert or update of status on public.wil_applications for each row execute function public.adminos_wil_whatsapp_trigger();

create or replace function public.adminos_support_whatsapp_trigger() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(new.consent_to_be_contacted,false) and coalesce(new.popia_consent,false) then
    perform public.adminos_enqueue_whatsapp_site_event('support_query_created','application_support_queries',new.id,new.user_id,coalesce(new.whatsapp_number,new.phone),jsonb_build_object('support_query_id',new.id,'institution_type',new.institution_type,'preferred_institution',new.preferred_institution,'preferred_campus',new.preferred_campus,'needs_accommodation',new.needs_accommodation,'user_name',new.full_name),'created');
  end if;
  return new;
end; $$;

drop trigger if exists trg_adminos_support_whatsapp on public.application_support_queries;
create trigger trg_adminos_support_whatsapp after insert on public.application_support_queries for each row execute function public.adminos_support_whatsapp_trigger();

create or replace function public.adminos_residence_lead_whatsapp_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare r public.residences%rowtype;
begin
  select * into r from public.residences where id=new.residence_id;
  perform public.adminos_enqueue_whatsapp_site_event('residence_enquiry_created','residence_leads',new.id,new.user_id,new.contact_phone,jsonb_build_object('lead_id',new.id,'stage',new.stage,'academic_year',new.academic_year,'funding_type',new.funding_type,'room_preference',new.room_preference,'residence_id',new.residence_id,'residence_name',r.name,'residence_image',coalesce(r.cover_image_url,r.image_url),'residence_slug',r.slug,'user_name',new.contact_name),'created');
  return new;
end; $$;

drop trigger if exists trg_adminos_residence_lead_whatsapp on public.residence_leads;
create trigger trg_adminos_residence_lead_whatsapp after insert on public.residence_leads for each row execute function public.adminos_residence_lead_whatsapp_trigger();

-- Realtime visibility for the premium control centre.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='adminos_whatsapp_rich_content') then alter publication supabase_realtime add table public.adminos_whatsapp_rich_content; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='adminos_whatsapp_site_events') then alter publication supabase_realtime add table public.adminos_whatsapp_site_events; end if;
end $$;

-- Event worker: every minute for near-real-time transactional confirmations.
do $$ begin
  if exists(select 1 from cron.job where jobname='adminos-whatsapp-event-worker') then perform cron.unschedule('adminos-whatsapp-event-worker'); end if;
end $$;
select cron.schedule('adminos-whatsapp-event-worker','* * * * *',$job$
  select net.http_post(
    url := 'https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/adminos-whatsapp-event-worker',
    headers := jsonb_build_object('Content-Type','application/json','x-adminos-cron-token',(select secret_value from public.adminos_scheduler_secrets where secret_key='whatsapp_event_worker')),
    body := '{"action":"tick","source":"pg_cron"}'::jsonb,
    timeout_milliseconds := 25000
  );
$job$);