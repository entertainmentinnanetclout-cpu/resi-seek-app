create extension if not exists pgcrypto;

create table if not exists public.seo_pages (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  entity_type text,
  entity_id uuid,
  title text not null,
  description text not null,
  h1 text,
  primary_keyword text,
  search_intent text,
  canonical_path text,
  og_title text,
  og_description text,
  og_image text,
  schema_type text,
  schema_data jsonb not null default '{}'::jsonb,
  breadcrumbs jsonb not null default '[]'::jsonb,
  indexable boolean not null default true,
  follow_links boolean not null default true,
  content_status text not null default 'published' check (content_status in ('draft','published','archived')),
  published_at timestamptz,
  last_verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  canonical_name text not null,
  slug text not null,
  description text,
  url_path text,
  city text,
  province text,
  country text not null default 'South Africa',
  latitude numeric,
  longitude numeric,
  metadata jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_type, slug)
);

create table if not exists public.seo_entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.seo_entities(id) on delete cascade,
  alias text not null,
  alias_type text not null default 'alternate_name',
  created_at timestamptz not null default now(),
  unique(entity_id, alias)
);

create table if not exists public.seo_entity_relations (
  id uuid primary key default gen_random_uuid(),
  from_entity_id uuid not null references public.seo_entities(id) on delete cascade,
  relation_type text not null,
  to_entity_id uuid not null references public.seo_entities(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(from_entity_id, relation_type, to_entity_id)
);

create table if not exists public.seo_search_intents (
  id uuid primary key default gen_random_uuid(),
  pillar text not null,
  cluster text not null,
  intent text not null,
  query_pattern text not null,
  priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
  target_path text,
  status text not null default 'planned' check (status in ('planned','covered','needs_improvement','retired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(query_pattern)
);

create table if not exists public.seo_redirects (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique,
  destination_path text not null,
  status_code integer not null default 301 check (status_code in (301,302,307,308)),
  is_active boolean not null default true,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_sources (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.seo_pages(id) on delete cascade,
  source_name text not null,
  source_url text not null,
  source_type text,
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_index_queue (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  action text not null default 'updated' check (action in ('created','updated','deleted')),
  engines text[] not null default array['bing_indexnow']::text[],
  status text not null default 'pending' check (status in ('pending','processing','submitted','failed','skipped')),
  attempts integer not null default 0,
  last_error text,
  queued_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists seo_index_queue_pending_idx on public.seo_index_queue(status, queued_at);

create table if not exists public.seo_audit_log (
  id uuid primary key default gen_random_uuid(),
  path text,
  audit_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_page_metrics (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.seo_pages(id) on delete cascade,
  metric_date date not null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  conversions bigint not null default 0,
  avg_position numeric,
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(page_id, metric_date, source)
);

create table if not exists public.property_opportunities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  opportunity_type text not null,
  status text not null default 'active',
  address text,
  suburb text,
  city text,
  province text,
  latitude numeric,
  longitude numeric,
  asking_price numeric,
  price_basis text,
  auction_date timestamptz,
  bedrooms integer,
  bathrooms integer,
  units_count integer,
  advertised_bed_capacity integer,
  erf_size_m2 numeric,
  floor_area_m2 numeric,
  nearest_institution text,
  accreditation_claim text,
  source_name text,
  source_url text,
  contact_name text,
  contact_phone text,
  contact_email text,
  summary text,
  due_diligence_notes text,
  reskonnect_score numeric,
  location_score numeric,
  demand_score numeric,
  investment_score numeric,
  risk_score numeric,
  is_published boolean not null default false,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists property_opportunities_public_idx on public.property_opportunities(is_published,status,city,suburb);
create index if not exists property_opportunities_auction_idx on public.property_opportunities(auction_date) where auction_date is not null;

create table if not exists public.public_opportunities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  opportunity_type text not null,
  organisation text,
  location text,
  province text,
  description text,
  requirements text,
  application_url text,
  closing_date timestamptz,
  date_posted timestamptz not null default now(),
  employment_type text,
  is_published boolean not null default false,
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seo_pages enable row level security;
alter table public.seo_entities enable row level security;
alter table public.seo_entity_aliases enable row level security;
alter table public.seo_entity_relations enable row level security;
alter table public.seo_search_intents enable row level security;
alter table public.seo_redirects enable row level security;
alter table public.seo_sources enable row level security;
alter table public.seo_index_queue enable row level security;
alter table public.seo_audit_log enable row level security;
alter table public.seo_page_metrics enable row level security;
alter table public.property_opportunities enable row level security;
alter table public.public_opportunities enable row level security;

do $$ begin
  create policy "public read published seo pages" on public.seo_pages for select using (indexable and content_status='published');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read seo entities" on public.seo_entities for select using (is_public);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read seo aliases" on public.seo_entity_aliases for select using (exists(select 1 from public.seo_entities e where e.id=entity_id and e.is_public));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read seo relations" on public.seo_entity_relations for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read covered intents" on public.seo_search_intents for select using (status in ('covered','needs_improvement'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read active redirects" on public.seo_redirects for select using (is_active);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read seo sources" on public.seo_sources for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read property opportunities" on public.property_opportunities for select using (is_published);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read opportunities" on public.public_opportunities for select using (is_published);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "staff manage seo pages" on public.seo_pages for all to authenticated using (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator')) with check (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff manage seo entities" on public.seo_entities for all to authenticated using (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator')) with check (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff manage seo intents" on public.seo_search_intents for all to authenticated using (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator')) with check (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff manage redirects" on public.seo_redirects for all to authenticated using (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator')) with check (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff manage property opportunities" on public.property_opportunities for all to authenticated using (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator')) with check (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff manage public opportunities" on public.public_opportunities for all to authenticated using (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator','tvet_lead')) with check (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator','tvet_lead'));
exception when duplicate_object then null; end $$;

insert into public.seo_entities(entity_type,canonical_name,slug,description,url_path,country,last_verified_at)
values ('organization','ResKonnect','reskonnect','South African platform connecting student living, applications, AI-powered guidance, property intelligence and opportunities.','/','South Africa',now())
on conflict (entity_type,slug) do update set canonical_name=excluded.canonical_name,description=excluded.description,url_path=excluded.url_path,last_verified_at=excluded.last_verified_at,updated_at=now();

insert into public.seo_entity_aliases(entity_id,alias,alias_type)
select id, x.alias, 'brand_variant' from public.seo_entities cross join lateral (values ('Res Konnect'),('ResConnect'),('Res Connect'),('reskonnect')) x(alias)
where entity_type='organization' and slug='reskonnect'
on conflict do nothing;

insert into public.seo_search_intents(pillar,cluster,intent,query_pattern,priority,target_path,status) values
('living','generic','commercial','student accommodation','critical','/student-accommodation','covered'),
('living','funding','commercial','NSFAS accommodation','critical','/student-accommodation/nsfas-accredited','covered'),
('living','location','commercial','student accommodation Pretoria','critical','/student-accommodation/pretoria','planned'),
('living','institution','commercial','student accommodation near TUT','critical','/student-accommodation/near-tut','covered'),
('living','institution','commercial','TUT accommodation','critical','/student-accommodation/near-tut','covered'),
('applications','generic','informational','university applications South Africa','high','/applications/university','covered'),
('applications','tvet','informational','TVET college applications','high','/applications/tvet','covered'),
('applications','readiness','tool','APS checker','high','/applications/aps-checker','covered'),
('opportunity','wil','commercial','WIL placement opportunities','critical','/opportunities/wil','covered'),
('opportunity','seta','commercial','SETA opportunities','high','/opportunities/seta','planned'),
('opportunity','internships','commercial','student internships South Africa','high','/opportunities/internships','planned'),
('property','investment','commercial','student accommodation for sale','critical','/student-accommodation-for-sale','planned'),
('property','auction','commercial','student accommodation auctions','critical','/property-auctions','planned'),
('property','development','commercial','student housing development opportunities','high','/development-opportunities','planned'),
('brand','brand','navigational','ResKonnect','critical','/','covered'),
('brand','brand','navigational','Res Konnect','critical','/','covered'),
('brand','brand','navigational','ResConnect','high','/','covered'),
('brand','brand','navigational','Res Connect','high','/','covered')
on conflict (query_pattern) do update set target_path=excluded.target_path,status=excluded.status,priority=excluded.priority,updated_at=now();

insert into public.seo_pages(path,title,description,h1,primary_keyword,search_intent,canonical_path,schema_type,indexable,content_status,published_at,last_verified_at) values
('/','ResKonnect | Student Accommodation, Applications, Property & Opportunities','Find student accommodation, application readiness, WIL and internship opportunities, student property investments and AI-powered student support across South Africa.','Connecting Residents. Advancing Futures.','ResKonnect','navigational','/','WebPage',true,'published',now(),now()),
('/student-accommodation','Student Accommodation South Africa | ResKonnect','Find verified student accommodation, private rentals and NSFAS accommodation options near universities and TVET campuses across South Africa.','Find Student Accommodation in South Africa','student accommodation','commercial','/student-accommodation','CollectionPage',true,'published',now(),now()),
('/applications','University & TVET Applications South Africa | ResKonnect','Prepare university, TVET and private-college applications with application readiness, APS guidance, Course Match and document support.','Applications & Course Readiness','student applications South Africa','informational','/applications','CollectionPage',true,'published',now(),now()),
('/opportunities','WIL, Internships & Student Opportunities | ResKonnect','Discover WIL placements, internships, SETA programmes, graduate opportunities and student career support.','Student Opportunities','student opportunities South Africa','commercial','/opportunities','CollectionPage',true,'published',now(),now()),
('/properties','Student Housing Property & Investment Opportunities | ResKonnect','Discover student accommodation for sale, property auctions, conversion opportunities and student-housing investment intelligence.','Student Housing Property Opportunities','student accommodation property','commercial','/properties','CollectionPage',true,'published',now(),now()),
('/property-auctions','Student Accommodation Property Auctions South Africa | ResKonnect','Track third-party student housing auctions, distressed property opportunities and investment properties suitable for student accommodation.','Student Accommodation Property Auctions','student accommodation auctions','commercial','/property-auctions','CollectionPage',true,'published',now(),now()),
('/student-accommodation-for-sale','Student Accommodation for Sale South Africa | ResKonnect','Explore student residences, houses, flats and buildings for sale with student-housing investment potential.','Student Accommodation for Sale','student accommodation for sale','commercial','/student-accommodation-for-sale','CollectionPage',true,'published',now(),now()),
('/ai','ResKonnect AI | Student, Course & Property Intelligence','Use ResKonnect AI-powered tools for student guidance, course matching, application readiness and property intelligence.','ResKonnect AI','student AI South Africa','informational','/ai','CollectionPage',true,'published',now(),now())
on conflict (path) do update set title=excluded.title,description=excluded.description,h1=excluded.h1,primary_keyword=excluded.primary_keyword,search_intent=excluded.search_intent,canonical_path=excluded.canonical_path,schema_type=excluded.schema_type,indexable=excluded.indexable,content_status=excluded.content_status,last_verified_at=now(),updated_at=now();
