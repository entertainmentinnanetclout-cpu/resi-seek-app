-- Premium WhatsApp v2: guided Applications/WIL/company journeys, media archive queue,
-- and a live residence readiness view used by Luna/AdminOS.

create table if not exists public.adminos_whatsapp_media_files (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.adminos_whatsapp_messages(id) on delete cascade,
  thread_id uuid not null references public.adminos_whatsapp_threads(id) on delete cascade,
  direction text not null,
  storage_bucket text not null default 'adminos-whatsapp-media',
  storage_path text not null unique,
  original_name text,
  content_type text,
  size_bytes bigint,
  media_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_adminos_whatsapp_media_files_thread on public.adminos_whatsapp_media_files(thread_id, created_at desc);
create index if not exists idx_adminos_whatsapp_media_files_message on public.adminos_whatsapp_media_files(message_id);
alter table public.adminos_whatsapp_media_files enable row level security;
drop policy if exists "AdminOS staff read WhatsApp media files" on public.adminos_whatsapp_media_files;
create policy "AdminOS staff read WhatsApp media files" on public.adminos_whatsapp_media_files for select to authenticated using ((select public.adminos_is_staff()));
revoke all on public.adminos_whatsapp_media_files from anon;
grant select on public.adminos_whatsapp_media_files to authenticated;

create table if not exists public.adminos_whatsapp_media_archive_queue (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.adminos_whatsapp_messages(id) on delete cascade,
  thread_id uuid not null references public.adminos_whatsapp_threads(id) on delete cascade,
  status text not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adminos_whatsapp_media_archive_status_check check (status in ('pending','processing','archived','failed','blocked'))
);
create index if not exists idx_adminos_whatsapp_media_archive_due on public.adminos_whatsapp_media_archive_queue(status,available_at);
alter table public.adminos_whatsapp_media_archive_queue enable row level security;
drop policy if exists "AdminOS staff read media archive queue" on public.adminos_whatsapp_media_archive_queue;
create policy "AdminOS staff read media archive queue" on public.adminos_whatsapp_media_archive_queue for select to authenticated using ((select public.adminos_is_staff()));
revoke all on public.adminos_whatsapp_media_archive_queue from anon;
grant select on public.adminos_whatsapp_media_archive_queue to authenticated;

create or replace function public.adminos_queue_whatsapp_media_archive() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.direction='inbound' and jsonb_typeof(coalesce(new.media,'[]'::jsonb))='array' and jsonb_array_length(coalesce(new.media,'[]'::jsonb))>0 then
    insert into public.adminos_whatsapp_media_archive_queue(message_id,thread_id,status,available_at,updated_at)
    values(new.id,new.thread_id,'pending',now(),now())
    on conflict(message_id) do update set
      status=case when public.adminos_whatsapp_media_archive_queue.status='archived' then 'archived' else 'pending' end,
      available_at=case when public.adminos_whatsapp_media_archive_queue.status='archived' then public.adminos_whatsapp_media_archive_queue.available_at else now() end,
      updated_at=now();
  end if;
  return new;
end; $$;
revoke all on function public.adminos_queue_whatsapp_media_archive() from public,anon,authenticated;
drop trigger if exists trg_adminos_queue_whatsapp_media_archive on public.adminos_whatsapp_messages;
create trigger trg_adminos_queue_whatsapp_media_archive after insert or update of media on public.adminos_whatsapp_messages for each row execute function public.adminos_queue_whatsapp_media_archive();

insert into public.adminos_whatsapp_media_archive_queue(message_id,thread_id,status)
select id,thread_id,'pending'
from public.adminos_whatsapp_messages
where direction='inbound' and jsonb_typeof(coalesce(media,'[]'::jsonb))='array' and jsonb_array_length(coalesce(media,'[]'::jsonb))>0
on conflict(message_id) do nothing;

create or replace view public.adminos_residence_readiness_v as
select
  r.id,
  r.name,
  r.slug,
  r.campus,
  r.city,
  r.address,
  r.price,
  r.private_price,
  r.nsfas_price,
  r.available_spots,
  coalesce(r.cover_image_url,r.image_url,case when coalesce(array_length(r.images,1),0)>0 then r.images[1] else null end) as primary_image_url,
  coalesce(array_length(r.images,1),0) as gallery_image_count,
  (coalesce(r.cover_image_url,r.image_url) is not null or coalesce(array_length(r.images,1),0)>0) as has_image,
  (r.price is not null or r.private_price is not null or r.nsfas_price is not null) as has_price,
  (coalesce(nullif(r.city,''),nullif(r.campus,''),nullif(r.address,'')) is not null) as has_location,
  (r.available_spots is not null) as has_availability,
  (r.slug is not null and r.slug<>'') as has_public_link,
  (coalesce(r.accepts_university,false) or coalesce(r.accepts_tvet,false) or coalesce(r.accepts_private,false)) as has_audience,
  (
    (case when coalesce(r.cover_image_url,r.image_url) is not null or coalesce(array_length(r.images,1),0)>0 then 30 else 0 end) +
    (case when r.price is not null or r.private_price is not null or r.nsfas_price is not null then 20 else 0 end) +
    (case when coalesce(nullif(r.city,''),nullif(r.campus,''),nullif(r.address,'')) is not null then 15 else 0 end) +
    (case when r.available_spots is not null then 10 else 0 end) +
    (case when r.slug is not null and r.slug<>'' then 10 else 0 end) +
    (case when coalesce(r.accepts_university,false) or coalesce(r.accepts_tvet,false) or coalesce(r.accepts_private,false) then 10 else 0 end) +
    (case when coalesce(r.room_type,'')<>'' or coalesce(array_length(r.room_types,1),0)>0 then 5 else 0 end)
  )::integer as readiness_score,
  array_remove(array[
    case when not (coalesce(r.cover_image_url,r.image_url) is not null or coalesce(array_length(r.images,1),0)>0) then 'images' end,
    case when not (r.price is not null or r.private_price is not null or r.nsfas_price is not null) then 'rent' end,
    case when coalesce(nullif(r.city,''),nullif(r.campus,''),nullif(r.address,'')) is null then 'location' end,
    case when r.available_spots is null then 'availability' end,
    case when r.slug is null or r.slug='' then 'public_link' end,
    case when not (coalesce(r.accepts_university,false) or coalesce(r.accepts_tvet,false) or coalesce(r.accepts_private,false)) then 'audience' end,
    case when coalesce(r.room_type,'')='' and coalesce(array_length(r.room_types,1),0)=0 then 'room_type' end
  ],null)::text[] as missing_fields,
  r.updated_at
from public.residences r
where coalesce(r.is_visible,true)=true;

grant select on public.adminos_residence_readiness_v to authenticated;

insert into public.adminos_whatsapp_rich_content(content_key,display_name,content_type,approval_required,purpose,config)
values
('rk_application_menu_v2','Applications concierge','twilio/list-picker',false,'service',jsonb_build_object(
  'body','Applications can be confusing. Choose exactly what you need and Luna will guide you from there.',
  'button','Applications',
  'items',jsonb_build_array(
    jsonb_build_object('item','Track my application','id','app:status','description','Check your latest ResKonnect application status'),
    jsonb_build_object('item','Documents & missing items','id','app:missing','description','See document issues and secure upload guidance'),
    jsonb_build_object('item','University applications','id','app:university','description','University application guidance'),
    jsonb_build_object('item','TVET / college applications','id','app:tvet','description','TVET and public college application guidance'),
    jsonb_build_object('item','Private college applications','id','app:private-college','description','Private college application guidance'),
    jsonb_build_object('item','APS / readiness checker','id','app:checker','description','Prepare choices and check application readiness'),
    jsonb_build_object('item','Start an application','id','app:start','description','Open the ResKonnect applications hub'),
    jsonb_build_object('item','Accommodation application','id','menu:accommodation','description','Find or continue accommodation'),
    jsonb_build_object('item','Speak to a human','id','menu:human','description','Escalate a protected or unusual issue'),
    jsonb_build_object('item','Main menu','id','menu:main','description','Return to all services')
  )
)),
('rk_wil_menu_v2','WIL guided concierge','twilio/list-picker',false,'service',jsonb_build_object(
  'body','Choose the WIL or opportunity support you need. Luna will guide routine steps and escalate protected placement decisions.',
  'button','WIL options',
  'items',jsonb_build_array(
    jsonb_build_object('item','Check WIL status','id','wil:status','description','Track your latest WIL application'),
    jsonb_build_object('item','Apply / get started','id','wil:apply','description','Open WIL and opportunity pathways'),
    jsonb_build_object('item','WIL requirements','id','wil:requirements','description','Understand common readiness requirements'),
    jsonb_build_object('item','WIL documents','id','wil:documents','description','Secure document and checklist guidance'),
    jsonb_build_object('item','Placement support','id','wil:placement','description','Guidance on workplace placement progress'),
    jsonb_build_object('item','Available opportunities','id','wil:opportunities','description','Explore published opportunities'),
    jsonb_build_object('item','Employer / host company','id','wil:employer','description','Employer, host-company or partnership enquiry'),
    jsonb_build_object('item','Funding / stipend question','id','wil:funding','description','Guidance on funding and stipend information'),
    jsonb_build_object('item','Speak to a human','id','menu:human','description','Escalate a protected or unusual issue'),
    jsonb_build_object('item','Main menu','id','menu:main','description','Return to all services')
  )
)),
('rk_company_menu','ResKonnect services concierge','twilio/list-picker',false,'service',jsonb_build_object(
  'body','Here is what ResKonnect can help with. Choose a service for a quick overview or next step.',
  'button','Our services',
  'items',jsonb_build_array(
    jsonb_build_object('item','About ResKonnect','id','company:about','description','Who we are and what the platform connects'),
    jsonb_build_object('item','Accommodation','id','company:living','description','Student living, private rentals and residence discovery'),
    jsonb_build_object('item','Applications','id','company:applications','description','Application guidance, readiness and support'),
    jsonb_build_object('item','WIL & Opportunities','id','company:opportunities','description','Work-integrated learning and opportunity support'),
    jsonb_build_object('item','Landlords & properties','id','company:property','description','Listing, residence portals and property partnerships'),
    jsonb_build_object('item','AI & digital solutions','id','company:ai','description','AI-enabled service and digital platform solutions'),
    jsonb_build_object('item','Partnerships','id','menu:partnerships','description','Institutional, business and strategic partnerships'),
    jsonb_build_object('item','Contact / human team','id','menu:human','description','Escalate when a person is required'),
    jsonb_build_object('item','Main menu','id','menu:main','description','Return to all services')
  )
))
on conflict(content_key) do update set
  display_name=excluded.display_name,
  content_type=excluded.content_type,
  approval_required=excluded.approval_required,
  purpose=excluded.purpose,
  config=excluded.config,
  content_sid=case when public.adminos_whatsapp_rich_content.config is distinct from excluded.config then null else public.adminos_whatsapp_rich_content.content_sid end,
  status=case when public.adminos_whatsapp_rich_content.config is distinct from excluded.config then 'not_created' else public.adminos_whatsapp_rich_content.status end,
  updated_at=now();

insert into public.adminos_whatsapp_journeys(journey_key,display_name,description,trigger_terms,entry_content_key,enabled,escalation_required,config)
values
('company','Company & services','Basic company, service and contact information',array['about reskonnect','services','what do you do','company','living ai opportunity','property services','digital solutions'],'rk_company_menu',true,false,jsonb_build_object('coverage_target',0.99)),
('applications_v2','Applications guided concierge','University, TVET, private college, readiness, documents and tracking',array['application','university application','college application','tvet application','aps','readiness','documents'],'rk_application_menu_v2',true,false,jsonb_build_object('guided',true)),
('wil_v2','WIL guided concierge','WIL status, readiness, documents, opportunities, placement and host-company enquiries',array['wil','work integrated learning','placement','internship','host company','opportunity'],'rk_wil_menu_v2',true,false,jsonb_build_object('guided',true))
on conflict(journey_key) do update set display_name=excluded.display_name,description=excluded.description,trigger_terms=excluded.trigger_terms,entry_content_key=excluded.entry_content_key,enabled=excluded.enabled,escalation_required=excluded.escalation_required,config=excluded.config,updated_at=now();

do $$ begin
  if exists(select 1 from cron.job where jobname='adminos-whatsapp-media-archive') then
    perform cron.unschedule('adminos-whatsapp-media-archive');
  end if;
end $$;
select cron.schedule('adminos-whatsapp-media-archive','* * * * *',$job$
  select net.http_post(
    url := 'https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/adminos-whatsapp-media-worker',
    headers := jsonb_build_object('Content-Type','application/json','x-adminos-cron-token',(select secret_value from public.adminos_scheduler_secrets where secret_key='whatsapp_event_worker')),
    body := '{"action":"tick","source":"pg_cron"}'::jsonb,
    timeout_milliseconds := 30000
  );
$job$);

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='adminos_whatsapp_media_files') then
    alter publication supabase_realtime add table public.adminos_whatsapp_media_files;
  end if;
end $$;