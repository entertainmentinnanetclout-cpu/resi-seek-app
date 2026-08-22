alter table public.seo_pages
  add column if not exists answer_summary text,
  add column if not exists content_blocks jsonb not null default '[]'::jsonb,
  add column if not exists entity_facts jsonb not null default '[]'::jsonb,
  add column if not exists faq_items jsonb not null default '[]'::jsonb,
  add column if not exists cta jsonb not null default '{}'::jsonb,
  add column if not exists locale text not null default 'en-ZA',
  add column if not exists search_territory text[] not null default '{}'::text[],
  add column if not exists quality_score smallint not null default 0,
  add column if not exists unique_data_score smallint not null default 0,
  add column if not exists content_completeness smallint not null default 0,
  add column if not exists ai_citation_ready boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='seo_pages_quality_score_check') then
    alter table public.seo_pages add constraint seo_pages_quality_score_check check (quality_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='seo_pages_unique_data_score_check') then
    alter table public.seo_pages add constraint seo_pages_unique_data_score_check check (unique_data_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='seo_pages_content_completeness_check') then
    alter table public.seo_pages add constraint seo_pages_content_completeness_check check (content_completeness between 0 and 100);
  end if;
end $$;

create index if not exists seo_pages_search_territory_gin on public.seo_pages using gin(search_territory);
create index if not exists seo_pages_ai_ready_idx on public.seo_pages(ai_citation_ready) where indexable and content_status='published';

create table if not exists public.seo_site_config (
  config_key text primary key,
  config_value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);
alter table public.seo_site_config enable row level security;

drop policy if exists "public read seo site config" on public.seo_site_config;
create policy "public read seo site config" on public.seo_site_config for select to public using (is_public);
drop policy if exists "staff manage seo site config" on public.seo_site_config;
create policy "staff manage seo site config" on public.seo_site_config for all to authenticated
using ((get_my_role())::text = any(array['admin','super_admin','developer','owner','operations_lead','growth_lead','system_operator']))
with check ((get_my_role())::text = any(array['admin','super_admin','developer','owner','operations_lead','growth_lead','system_operator']));

create table if not exists public.seo_crawler_registry (
  crawler_key text primary key,
  user_agent text not null unique,
  purpose text not null,
  allow_public boolean not null default true,
  allow_training boolean,
  documentation_url text,
  notes text,
  last_verified_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.seo_crawler_registry enable row level security;
drop policy if exists "public read crawler registry" on public.seo_crawler_registry;
create policy "public read crawler registry" on public.seo_crawler_registry for select to public using (true);
drop policy if exists "staff manage crawler registry" on public.seo_crawler_registry;
create policy "staff manage crawler registry" on public.seo_crawler_registry for all to authenticated
using ((get_my_role())::text = any(array['admin','super_admin','developer','owner','operations_lead','growth_lead','system_operator']))
with check ((get_my_role())::text = any(array['admin','super_admin','developer','owner','operations_lead','growth_lead','system_operator']));

create table if not exists public.seo_page_links (
  id uuid primary key default gen_random_uuid(),
  from_path text not null references public.seo_pages(path) on update cascade on delete cascade,
  to_path text not null,
  anchor_text text not null,
  relation_type text not null default 'related',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(from_path,to_path,anchor_text)
);
alter table public.seo_page_links enable row level security;
drop policy if exists "public read active seo links" on public.seo_page_links;
create policy "public read active seo links" on public.seo_page_links for select to public using (is_active);
drop policy if exists "staff manage seo links" on public.seo_page_links;
create policy "staff manage seo links" on public.seo_page_links for all to authenticated
using ((get_my_role())::text = any(array['admin','super_admin','developer','owner','operations_lead','growth_lead','system_operator']))
with check ((get_my_role())::text = any(array['admin','super_admin','developer','owner','operations_lead','growth_lead','system_operator']));

create or replace view public.seo_public_pages_v as
select id,path,entity_type,entity_id,title,description,h1,primary_keyword,search_intent,canonical_path,
       og_title,og_description,og_image,schema_type,schema_data,breadcrumbs,indexable,follow_links,
       published_at,last_verified_at,expires_at,updated_at,answer_summary,content_blocks,entity_facts,
       faq_items,cta,locale,search_territory,quality_score,unique_data_score,content_completeness,ai_citation_ready
from public.seo_pages
where indexable and content_status='published' and (expires_at is null or expires_at > now());

grant select on public.seo_public_pages_v to anon, authenticated;

create or replace view public.seo_search_coverage_v as
select i.pillar,
       count(*) as total_intents,
       count(*) filter (where i.status='covered') as covered_intents,
       count(*) filter (where p.path is not null and p.indexable and p.content_status='published') as live_target_pages,
       round(100.0 * count(*) filter (where i.status='covered') / nullif(count(*),0),1) as intent_coverage_pct,
       round(100.0 * count(*) filter (where p.path is not null and p.indexable and p.content_status='published') / nullif(count(*),0),1) as live_page_coverage_pct
from public.seo_search_intents i
left join public.seo_pages p on p.path=i.target_path
group by i.pillar;

grant select on public.seo_search_coverage_v to authenticated;

insert into public.seo_site_config(config_key,config_value,is_public,description) values
('site_identity', jsonb_build_object(
  'name','ResKonnect',
  'alternateNames',jsonb_build_array('Res Konnect','ResConnect','Res Connect','Resconnect'),
  'canonicalUrl','https://www.reskonnect.org',
  'locale','en-ZA',
  'country','ZA',
  'pillars',jsonb_build_array('Living','AI','Opportunity','Applications','Properties')
), true, 'Canonical ResKonnect identity and public brand aliases'),
('index_thresholds', jsonb_build_object('qualityScore',70,'contentCompleteness',70,'uniqueDataScore',40), false, 'Minimum automated quality thresholds for future programmatic index eligibility'),
('ai_search_policy', jsonb_build_object('publicSearchCrawling',true,'privateRoutesBlocked',true,'citationReadyRequiredForPriorityPages',true), true, 'Public AI-search discovery policy')
on conflict (config_key) do update set config_value=excluded.config_value,is_public=excluded.is_public,description=excluded.description,updated_at=now();

insert into public.seo_crawler_registry(crawler_key,user_agent,purpose,allow_public,allow_training,documentation_url,notes,last_verified_at) values
('googlebot','Googlebot','Google Search crawling and indexing',true,null,'https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers','Allow public indexable pages; private application routes remain blocked',now()),
('bingbot','bingbot','Bing Search and Copilot-connected web discovery',true,null,'https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0','Allow public indexable pages; use IndexNow for freshness',now()),
('oai-searchbot','OAI-SearchBot','ChatGPT Search discovery and citations',true,null,'https://platform.openai.com/docs/bots','Allow public indexable pages; private routes remain blocked',now())
on conflict (crawler_key) do update set user_agent=excluded.user_agent,purpose=excluded.purpose,allow_public=excluded.allow_public,documentation_url=excluded.documentation_url,notes=excluded.notes,last_verified_at=excluded.last_verified_at,updated_at=now();

insert into public.seo_entity_aliases(entity_id,alias,alias_type)
select e.id,a.alias,'brand_variant'
from public.seo_entities e
cross join (values ('Res Konnect'),('ResConnect'),('Res Connect'),('Resconnect')) a(alias)
where e.entity_type='organization' and e.canonical_name='ResKonnect'
on conflict do nothing;

update public.seo_pages set
  answer_summary = case path
    when '/' then 'ResKonnect is a South African platform connecting students and partners to student accommodation, application readiness, AI-powered guidance, WIL and career opportunities, and student-housing property intelligence.'
    when '/student-accommodation' then 'ResKonnect helps students discover student accommodation and private rental options near South African universities and TVET colleges, with filters for campus, budget, room type and availability.'
    when '/student-accommodation/pretoria' then 'ResKonnect lists and organises student accommodation across Pretoria, including options connected to TUT, UP, UNISA, SMU and surrounding campus areas.'
    when '/applications' then 'ResKonnect supports university, TVET and private-college application readiness with institution discovery, APS guidance, Course Match and document preparation tools.'
    when '/opportunities' then 'ResKonnect surfaces student and graduate opportunities including WIL placements, internships, SETA-linked programmes and bursaries.'
    when '/properties' then 'ResKonnect Property Intelligence brings together student accommodation for sale, auctions, conversion opportunities and investment analysis for the student-housing market.'
    when '/property-auctions' then 'ResKonnect tracks third-party property auctions and distressed opportunities relevant to student housing and links users to the appointed auctioneer or official source.'
    when '/student-accommodation-for-sale' then 'ResKonnect organises student residences, houses, flats and buildings marketed for sale where there is a credible student-housing investment case.'
    when '/development-opportunities' then 'ResKonnect identifies houses, buildings and development sites with potential for lawful student-housing conversion, subject to planning, building and accreditation due diligence.'
    when '/ai' then 'ResKonnect AI combines student guidance, Course Match, application readiness and property intelligence using structured ResKonnect data rather than generic web answers.'
    when '/opportunities/internships' then 'ResKonnect helps students and graduates discover internship, graduate and workplace-experience opportunities with clear closing dates and official application routes.'
    when '/opportunities/seta' then 'ResKonnect organises SETA-linked WIL, internship and workplace-experience opportunities for students and graduates.'
    else answer_summary end,
  search_territory = case path
    when '/' then array['reskonnect','res konnect','resconnect','student accommodation','student applications','WIL','student property']
    when '/student-accommodation' then array['student accommodation','student housing','student residences','private student accommodation','NSFAS accommodation']
    when '/student-accommodation/pretoria' then array['student accommodation Pretoria','Pretoria student housing','Pretoria student residences']
    when '/applications' then array['university applications South Africa','TVET applications','APS checker','course match','application readiness']
    when '/opportunities' then array['WIL opportunities','student internships','SETA opportunities','graduate opportunities','student bursaries']
    when '/properties' then array['student accommodation property','student housing investment','student accommodation for sale','property auctions']
    when '/property-auctions' then array['student accommodation auctions','property auctions Pretoria','student housing auction']
    when '/student-accommodation-for-sale' then array['student accommodation for sale','student residence for sale','student housing investment']
    when '/development-opportunities' then array['student housing development','student accommodation conversion','houses for student accommodation']
    when '/ai' then array['student AI South Africa','AI course matching','property AI','application AI']
    when '/opportunities/internships' then array['student internships South Africa','graduate opportunities','workplace experience']
    when '/opportunities/seta' then array['SETA opportunities','SETA internships','SETA WIL']
    else search_territory end,
  quality_score = greatest(quality_score,85),
  content_completeness = greatest(content_completeness,80),
  unique_data_score = greatest(unique_data_score,45),
  ai_citation_ready = true,
  last_verified_at = coalesce(last_verified_at,now()),
  updated_at = now()
where path in ('/','/student-accommodation','/student-accommodation/pretoria','/applications','/opportunities','/properties','/property-auctions','/student-accommodation-for-sale','/development-opportunities','/ai','/opportunities/internships','/opportunities/seta');

insert into public.seo_page_links(from_path,to_path,anchor_text,relation_type,sort_order) values
('/','/student-accommodation','Find student accommodation','pillar',10),
('/','/applications','Explore applications and Course Match','pillar',20),
('/','/opportunities','Find WIL and student opportunities','pillar',30),
('/','/properties','Explore student housing investments','pillar',40),
('/','/ai','Use ResKonnect AI','pillar',50),
('/student-accommodation','/student-accommodation/pretoria','Student accommodation in Pretoria','location',10),
('/student-accommodation','/applications','Prepare your student applications','related',20),
('/properties','/student-accommodation-for-sale','Student accommodation for sale','property',10),
('/properties','/property-auctions','Student accommodation property auctions','property',20),
('/properties','/development-opportunities','Student housing development opportunities','property',30),
('/opportunities','/opportunities/internships','Student internships and graduate opportunities','opportunity',10),
('/opportunities','/opportunities/seta','SETA opportunities','opportunity',20)
on conflict do nothing;

-- Expand management access across all existing Golden Search tables for the developer/super-admin/owner roles.
do $$
declare t text; p text;
begin
  foreach t in array array['seo_pages','seo_entities','seo_entity_aliases','seo_entity_relations','seo_redirects','seo_sources','seo_search_intents','seo_page_metrics','seo_index_queue','seo_audit_log'] loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t and cmd='ALL' loop
      execute format('drop policy if exists %I on public.%I',p,t);
    end loop;
    execute format('create policy %I on public.%I for all to authenticated using (((get_my_role())::text = any(array[''admin'',''super_admin'',''developer'',''owner'',''operations_lead'',''growth_lead'',''system_operator'']))) with check (((get_my_role())::text = any(array[''admin'',''super_admin'',''developer'',''owner'',''operations_lead'',''growth_lead'',''system_operator''])))','staff manage '||t,t);
  end loop;
end $$;
