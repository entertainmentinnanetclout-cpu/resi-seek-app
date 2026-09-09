-- Dimpho Intelligence Engine — Releases 1-4
-- R1: intelligence foundation + governed self-learning
-- R2: personality studio + version publishing
-- R3: RAG knowledge brain with vector + lexical retrieval
-- R4: app intelligence graph + repository sync foundations

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- R1 — Intelligence foundation
-- ---------------------------------------------------------------------------

create table if not exists public.dimpho_intelligence_settings (
  id smallint primary key default 1 check (id = 1),
  learning_enabled boolean not null default true,
  pii_redaction_enabled boolean not null default true,
  auto_promote_style_examples boolean not null default true,
  auto_promote_fact_updates boolean not null default false,
  min_auto_promote_score numeric(4,3) not null default 0.940 check (min_auto_promote_score between 0 and 1),
  min_repeated_occurrences integer not null default 2 check (min_repeated_occurrences >= 1),
  lesson_retention_days integer not null default 180 check (lesson_retention_days >= 30),
  knowledge_index_enabled boolean not null default true,
  app_sync_enabled boolean not null default true,
  embedding_model text not null default 'text-embedding-3-small',
  reasoning_model text not null default 'gpt-5.6-luna',
  release_state jsonb not null default '{"release_1":"active","release_2":"active","release_3":"active","release_4":"active"}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.dimpho_intelligence_settings(id) values (1) on conflict (id) do nothing;
alter table public.dimpho_intelligence_settings enable row level security;
drop policy if exists "Dimpho staff read settings" on public.dimpho_intelligence_settings;
create policy "Dimpho staff read settings" on public.dimpho_intelligence_settings for select to authenticated using ((select public.adminos_is_staff()));
drop policy if exists "Dimpho admin manage settings" on public.dimpho_intelligence_settings;
create policy "Dimpho admin manage settings" on public.dimpho_intelligence_settings for update to authenticated using ((select public.has_role(auth.uid(),'admin'::public.app_role))) with check ((select public.has_role(auth.uid(),'admin'::public.app_role)));
revoke all on public.dimpho_intelligence_settings from anon;
grant select,update on public.dimpho_intelligence_settings to authenticated;

create table if not exists public.dimpho_conversation_events (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp','in_app','email','voice','web')),
  thread_id uuid,
  message_id uuid,
  direction text,
  occurred_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued','processing','processed','skipped','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default (now() + interval '2 minutes'),
  processed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(channel,message_id)
);
create index if not exists idx_dimpho_conversation_events_queue on public.dimpho_conversation_events(status,available_at,occurred_at);
create index if not exists idx_dimpho_conversation_events_thread on public.dimpho_conversation_events(channel,thread_id,occurred_at desc);
alter table public.dimpho_conversation_events enable row level security;
drop policy if exists "Dimpho staff read conversation events" on public.dimpho_conversation_events;
create policy "Dimpho staff read conversation events" on public.dimpho_conversation_events for select to authenticated using ((select public.adminos_is_staff()));
revoke all on public.dimpho_conversation_events from anon,authenticated;
grant select on public.dimpho_conversation_events to authenticated;

create table if not exists public.dimpho_lesson_candidates (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  lesson_type text not null check (lesson_type in ('style','workflow','knowledge_gap','successful_resolution','failed_resolution','tool_selection','safety','conversion')),
  category text not null default 'general',
  user_excerpt_redacted text,
  assistant_excerpt_redacted text,
  candidate_text text not null,
  ideal_response text,
  quality_score numeric(4,3) not null default 0 check (quality_score between 0 and 1),
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  safety_score numeric(4,3) not null default 1 check (safety_score between 0 and 1),
  pii_detected boolean not null default false,
  sensitive_topic boolean not null default false,
  source_channel text,
  source_thread_ids uuid[] not null default '{}',
  occurrence_count integer not null default 1,
  status text not null default 'candidate' check (status in ('candidate','auto_promoted','approved','rejected','superseded')),
  auto_promoted boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create index if not exists idx_dimpho_lesson_candidates_status on public.dimpho_lesson_candidates(status,quality_score desc,last_seen_at desc);
create index if not exists idx_dimpho_lesson_candidates_category on public.dimpho_lesson_candidates(category,lesson_type);
alter table public.dimpho_lesson_candidates enable row level security;
drop policy if exists "Dimpho staff read lessons" on public.dimpho_lesson_candidates;
create policy "Dimpho staff read lessons" on public.dimpho_lesson_candidates for select to authenticated using ((select public.adminos_is_staff()));
drop policy if exists "Dimpho admin review lessons" on public.dimpho_lesson_candidates;
create policy "Dimpho admin review lessons" on public.dimpho_lesson_candidates for update to authenticated using ((select public.has_role(auth.uid(),'admin'::public.app_role))) with check ((select public.has_role(auth.uid(),'admin'::public.app_role)));
revoke all on public.dimpho_lesson_candidates from anon;
grant select,update on public.dimpho_lesson_candidates to authenticated;

create table if not exists public.dimpho_training_examples (
  id uuid primary key default gen_random_uuid(),
  source_candidate_id uuid references public.dimpho_lesson_candidates(id) on delete set null,
  category text not null default 'general',
  channel text,
  user_input text not null,
  ideal_output text not null,
  tags text[] not null default '{}',
  quality_score numeric(4,3) not null default 0.9 check (quality_score between 0 and 1),
  provenance text not null default 'conversation_learning' check (provenance in ('conversation_learning','admin_authored','eval_repair','knowledge_verified')),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_candidate_id)
);
create index if not exists idx_dimpho_training_examples_active on public.dimpho_training_examples(active,category,quality_score desc);
alter table public.dimpho_training_examples enable row level security;
drop policy if exists "Dimpho staff read examples" on public.dimpho_training_examples;
create policy "Dimpho staff read examples" on public.dimpho_training_examples for select to authenticated using ((select public.adminos_is_staff()));
drop policy if exists "Dimpho admin manage examples" on public.dimpho_training_examples;
create policy "Dimpho admin manage examples" on public.dimpho_training_examples for all to authenticated using ((select public.has_role(auth.uid(),'admin'::public.app_role))) with check ((select public.has_role(auth.uid(),'admin'::public.app_role)));
revoke all on public.dimpho_training_examples from anon;
grant select,insert,update,delete on public.dimpho_training_examples to authenticated;

create table if not exists public.dimpho_dataset_releases (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  name text not null,
  status text not null default 'draft' check (status in ('draft','frozen','exported','retired')),
  example_count integer not null default 0,
  checksum text,
  filters jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  frozen_at timestamptz
);
alter table public.dimpho_dataset_releases enable row level security;
drop policy if exists "Dimpho staff read datasets" on public.dimpho_dataset_releases;
create policy "Dimpho staff read datasets" on public.dimpho_dataset_releases for select to authenticated using ((select public.adminos_is_staff()));
drop policy if exists "Dimpho admin manage datasets" on public.dimpho_dataset_releases;
create policy "Dimpho admin manage datasets" on public.dimpho_dataset_releases for all to authenticated using ((select public.has_role(auth.uid(),'admin'::public.app_role))) with check ((select public.has_role(auth.uid(),'admin'::public.app_role)));
revoke all on public.dimpho_dataset_releases from anon;
grant select,insert,update,delete on public.dimpho_dataset_releases to authenticated;

-- ---------------------------------------------------------------------------
-- R2 — Personality Studio
-- ---------------------------------------------------------------------------

create table if not exists public.dimpho_personas (
  id uuid primary key default gen_random_uuid(),
  persona_key text not null unique,
  name text not null,
  role_title text not null,
  mission text not null,
  active_version_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dimpho_persona_versions (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.dimpho_personas(id) on delete cascade,
  version integer not null,
  name text not null,
  identity jsonb not null default '{}'::jsonb,
  tone jsonb not null default '{}'::jsonb,
  sliders jsonb not null default '{"warmth":82,"professionalism":92,"confidence":92,"humour":24,"conciseness":76,"proactivity":92,"empathy":86}'::jsonb,
  behavioural_rules text[] not null default '{}',
  forbidden_phrases text[] not null default '{}',
  channel_overrides jsonb not null default '{}'::jsonb,
  system_prompt_template text not null,
  compiled_prompt text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  source text not null default 'admin' check (source in ('admin','migration','learning_assisted')),
  created_by uuid,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(persona_id,version)
);
alter table public.dimpho_personas add constraint dimpho_personas_active_version_fk foreign key (active_version_id) references public.dimpho_persona_versions(id) on delete set null;
create index if not exists idx_dimpho_persona_versions_status on public.dimpho_persona_versions(persona_id,status,version desc);
alter table public.dimpho_personas enable row level security;
alter table public.dimpho_persona_versions enable row level security;

drop policy if exists "Dimpho staff read personas" on public.dimpho_personas;
create policy "Dimpho staff read personas" on public.dimpho_personas for select to authenticated using ((select public.adminos_is_staff()));
drop policy if exists "Dimpho admin manage personas" on public.dimpho_personas;
create policy "Dimpho admin manage personas" on public.dimpho_personas for all to authenticated using ((select public.has_role(auth.uid(),'admin'::public.app_role))) with check ((select public.has_role(auth.uid(),'admin'::public.app_role)));
drop policy if exists "Dimpho staff read persona versions" on public.dimpho_persona_versions;
create policy "Dimpho staff read persona versions" on public.dimpho_persona_versions for select to authenticated using ((select public.adminos_is_staff()));
drop policy if exists "Dimpho admin manage persona versions" on public.dimpho_persona_versions;
create policy "Dimpho admin manage persona versions" on public.dimpho_persona_versions for all to authenticated using ((select public.has_role(auth.uid(),'admin'::public.app_role))) with check ((select public.has_role(auth.uid(),'admin'::public.app_role)));
revoke all on public.dimpho_personas,public.dimpho_persona_versions from anon;
grant select,insert,update,delete on public.dimpho_personas,public.dimpho_persona_versions to authenticated;

create or replace function public.dimpho_compile_persona(p_version_id uuid)
returns text
language plpgsql security definer set search_path=public as $$
declare
  v public.dimpho_persona_versions%rowtype;
  p public.dimpho_personas%rowtype;
  v_rules text;
  v_forbidden text;
  v_prompt text;
begin
  select * into v from public.dimpho_persona_versions where id=p_version_id;
  if v.id is null then raise exception 'Persona version not found'; end if;
  select * into p from public.dimpho_personas where id=v.persona_id;
  v_rules := coalesce(array_to_string(v.behavioural_rules,E'\n- '),'');
  v_forbidden := coalesce(array_to_string(v.forbidden_phrases,', '),'');
  v_prompt := concat_ws(E'\n\n',
    'IDENTITY',
    format('You are %s, %s. %s',p.name,p.role_title,p.mission),
    'PERSONALITY CONTROLS',
    v.sliders::text,
    'BEHAVIOURAL RULES',
    case when v_rules='' then '- Resolve the user''s request naturally and accurately.' else '- '||v_rules end,
    'FORBIDDEN / ROBOTIC LANGUAGE',
    case when v_forbidden='' then 'Avoid generic bot disclaimers and repetitive filler.' else 'Never use these unless quoting the user: '||v_forbidden end,
    'CHANNEL OVERRIDES',
    v.channel_overrides::text,
    'RESKONNECT OPERATING RULES',
    'Use supplied trusted context and tools as the source of truth for live prices, availability, applications, account state, policies and workflow status. Never invent backend state. Ask at most one genuinely necessary clarification at a time. Preserve conversation continuity and do not repeat questions already answered. When a safe next action can be completed through an approved tool, prefer action over generic instructions. If a protected decision or unverified fact is required, say what is missing and escalate instead of bluffing. Never request passwords, OTPs, full banking credentials or unnecessary identity data in open chat. All public links must use https://www.reskonnect.org and only verified routes. Return the required structured JSON when the calling workflow requests JSON.',
    'PERSONA TEMPLATE',
    v.system_prompt_template
  );
  return v_prompt;
end; $$;
revoke all on function public.dimpho_compile_persona(uuid) from public,anon;
grant execute on function public.dimpho_compile_persona(uuid) to authenticated;

create or replace function public.dimpho_publish_persona_version(p_version_id uuid)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v public.dimpho_persona_versions%rowtype;
  v_prompt text;
  v_agent_version integer;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'God Mode AAL2 authentication required' using errcode='42501';
  end if;
  select * into v from public.dimpho_persona_versions where id=p_version_id for update;
  if v.id is null then raise exception 'Persona version not found'; end if;
  v_prompt := public.dimpho_compile_persona(v.id);

  update public.dimpho_persona_versions set status='archived' where persona_id=v.persona_id and status='published' and id<>v.id;
  update public.dimpho_persona_versions set status='published',compiled_prompt=v_prompt,published_at=now() where id=v.id;
  update public.dimpho_personas set active_version_id=v.id,updated_at=now() where id=v.persona_id;

  update public.adminos_agent_prompt_versions set active=false where agent_key='konnect_agent' and active=true;
  select coalesce(max(version),0)+1 into v_agent_version from public.adminos_agent_prompt_versions where agent_key='konnect_agent';
  insert into public.adminos_agent_prompt_versions(agent_key,version,name,system_prompt,policy,tool_allowlist,active,created_by)
  values(
    'konnect_agent',v_agent_version,'Dimpho Intelligence Studio v'||v.version,v_prompt,
    jsonb_build_object('dimpho_persona_version_id',v.id,'intelligence_release',4,'conversation_learning',true,'rag',true,'app_graph',true,'verified_data_only',true),
    jsonb_build_array('read_contact','read_application','read_residence','read_knowledge','read_app_flow','draft_reply','request_human_review'),
    true,auth.uid()
  );
  return jsonb_build_object('ok',true,'persona_version',v.version,'agent_prompt_version',v_agent_version,'published_at',now());
end; $$;
revoke all on function public.dimpho_publish_persona_version(uuid) from public,anon;
grant execute on function public.dimpho_publish_persona_version(uuid) to authenticated;

-- Seed the studio from the currently active production personality without losing prior work.
with p as (
  insert into public.dimpho_personas(persona_key,name,role_title,mission,metadata)
  values('dimpho','Dimpho','ResKonnect AI Concierge','Help people complete ResKonnect journeys with the competence, context and continuity of an excellent ResKonnect service professional.',jsonb_build_object('channel_scope',jsonb_build_array('web','in_app','whatsapp','email','voice')))
  on conflict(persona_key) do update set name=excluded.name
  returning id
), persona as (
  select id from p union all select id from public.dimpho_personas where persona_key='dimpho' limit 1
), active_prompt as (
  select system_prompt from public.adminos_agent_prompt_versions where agent_key='konnect_agent' and active=true order by version desc limit 1
)
insert into public.dimpho_persona_versions(persona_id,version,name,identity,tone,behavioural_rules,forbidden_phrases,channel_overrides,system_prompt_template,compiled_prompt,status,source,published_at)
select persona.id,1,'Production baseline',
  jsonb_build_object('name','Dimpho','company','ResKonnect','role','AI Concierge'),
  jsonb_build_object('style','natural, capable, proactive, human-service quality'),
  array['Use conversation continuity and never make the user repeat known context','Resolve the request before selling','Use verified backend state for live facts','Give one clear next action','Escalate protected or unverified decisions without bluffing','Adapt wording to the customer while preserving professionalism'],
  array['As an AI language model','I am just a bot','I cannot access anything'],
  jsonb_build_object('whatsapp',jsonb_build_object('concise',true,'avoid_markdown_tables',true),'web',jsonb_build_object('can_be_more_detailed',true)),
  coalesce((select system_prompt from active_prompt),'Be a highly capable ResKonnect service professional.'),
  coalesce((select system_prompt from active_prompt),'Be a highly capable ResKonnect service professional.'),
  'published','migration',now()
from persona
on conflict(persona_id,version) do nothing;
update public.dimpho_personas p set active_version_id=v.id,updated_at=now() from public.dimpho_persona_versions v where v.persona_id=p.id and p.persona_key='dimpho' and v.version=1 and p.active_version_id is null;

-- ---------------------------------------------------------------------------
-- R3 — Knowledge Brain / RAG
-- ---------------------------------------------------------------------------

create table if not exists public.dimpho_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null check (source_type in ('admin','legacy_knowledge','app_route','app_feature','workflow','release','policy','database_schema','conversation_verified')),
  source_ref text,
  source_url text,
  content text not null,
  checksum text,
  status text not null default 'published' check (status in ('draft','published','archived','needs_review')),
  sensitivity text not null default 'public' check (sensitivity in ('public','internal','restricted')),
  confidence numeric(4,3) not null default 0.95 check (confidence between 0 and 1),
  valid_from timestamptz,
  valid_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_type,source_ref)
);

create table if not exists public.dimpho_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.dimpho_knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  title text not null,
  content text not null,
  token_estimate integer,
  embedding extensions.vector(1536),
  embedding_model text,
  checksum text,
  search_tsv tsvector generated always as (to_tsvector('english',coalesce(title,'')||' '||coalesce(content,''))) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_id,chunk_index)
);
create index if not exists idx_dimpho_knowledge_chunks_doc on public.dimpho_knowledge_chunks(document_id,chunk_index);
create index if not exists idx_dimpho_knowledge_chunks_tsv on public.dimpho_knowledge_chunks using gin(search_tsv);
create index if not exists idx_dimpho_knowledge_chunks_trgm on public.dimpho_knowledge_chunks using gin(content extensions.gin_trgm_ops);
create index if not exists idx_dimpho_knowledge_chunks_embedding on public.dimpho_knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops) where embedding is not null;

create table if not exists public.dimpho_knowledge_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.dimpho_knowledge_documents(id) on delete cascade,
  job_type text not null default 'index' check (job_type in ('index','reindex','delete')),
  status text not null default 'queued' check (status in ('queued','processing','succeeded','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_dimpho_knowledge_jobs_queue on public.dimpho_knowledge_jobs(status,available_at,created_at);

alter table public.dimpho_knowledge_documents enable row level security;
alter table public.dimpho_knowledge_chunks enable row level security;
alter table public.dimpho_knowledge_jobs enable row level security;
drop policy if exists "Dimpho staff read knowledge documents" on public.dimpho_knowledge_documents;
create policy "Dimpho staff read knowledge documents" on public.dimpho_knowledge_documents for select to authenticated using ((select public.adminos_is_staff()));
drop policy if exists "Dimpho admin manage knowledge documents" on public.dimpho_knowledge_documents;
create policy "Dimpho admin manage knowledge documents" on public.dimpho_knowledge_documents for all to authenticated using ((select public.has_role(auth.uid(),'admin'::public.app_role))) with check ((select public.has_role(auth.uid(),'admin'::public.app_role)));
drop policy if exists "Dimpho staff read knowledge chunks" on public.dimpho_knowledge_chunks;
create policy "Dimpho staff read knowledge chunks" on public.dimpho_knowledge_chunks for select to authenticated using ((select public.adminos_is_staff()));
drop policy if exists "Dimpho staff read knowledge jobs" on public.dimpho_knowledge_jobs;
create policy "Dimpho staff read knowledge jobs" on public.dimpho_knowledge_jobs for select to authenticated using ((select public.adminos_is_staff()));
revoke all on public.dimpho_knowledge_documents,public.dimpho_knowledge_chunks,public.dimpho_knowledge_jobs from anon;
grant select,insert,update,delete on public.dimpho_knowledge_documents to authenticated;
grant select on public.dimpho_knowledge_chunks,public.dimpho_knowledge_jobs to authenticated;

create or replace function public.dimpho_queue_knowledge_index()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='published' and (tg_op='INSERT' or new.content is distinct from old.content or new.status is distinct from old.status or new.checksum is distinct from old.checksum) then
    insert into public.dimpho_knowledge_jobs(document_id,job_type,status) values(new.id,case when tg_op='INSERT' then 'index' else 'reindex' end,'queued');
  end if;
  return new;
end; $$;
drop trigger if exists trg_dimpho_queue_knowledge_index on public.dimpho_knowledge_documents;
create trigger trg_dimpho_queue_knowledge_index after insert or update on public.dimpho_knowledge_documents for each row execute function public.dimpho_queue_knowledge_index();

create or replace function public.dimpho_search_knowledge(
  p_query text,
  p_embedding_text text default null,
  p_limit integer default 8,
  p_min_confidence numeric default 0.55
) returns table(
  chunk_id uuid,
  document_id uuid,
  title text,
  content text,
  source_type text,
  source_ref text,
  confidence numeric,
  score double precision,
  metadata jsonb
)
language plpgsql stable security definer set search_path=public,extensions as $$
begin
  return query
  with candidates as (
    select c.id as chunk_id,c.document_id,c.title,c.content,d.source_type,d.source_ref,d.confidence,c.metadata,
      case when p_embedding_text is not null and c.embedding is not null then 1-(c.embedding <=> p_embedding_text::extensions.vector) else 0 end as semantic_score,
      ts_rank_cd(c.search_tsv,websearch_to_tsquery('english',coalesce(p_query,''))) as lexical_score,
      similarity(lower(c.content),lower(coalesce(p_query,''))) as trigram_score
    from public.dimpho_knowledge_chunks c
    join public.dimpho_knowledge_documents d on d.id=c.document_id
    where d.status='published'
      and d.confidence>=p_min_confidence
      and (d.valid_from is null or d.valid_from<=now())
      and (d.valid_until is null or d.valid_until>now())
      and d.sensitivity<>'restricted'
  )
  select candidates.chunk_id,candidates.document_id,candidates.title,candidates.content,candidates.source_type,candidates.source_ref,candidates.confidence,
    greatest(semantic_score*0.72 + lexical_score*0.23 + trigram_score*0.05, lexical_score*0.80 + trigram_score*0.20)::double precision as score,
    candidates.metadata
  from candidates
  where semantic_score>0.12 or lexical_score>0 or trigram_score>0.05
  order by score desc
  limit greatest(1,least(coalesce(p_limit,8),20));
end; $$;
revoke all on function public.dimpho_search_knowledge(text,text,integer,numeric) from public,anon;
grant execute on function public.dimpho_search_knowledge(text,text,integer,numeric) to authenticated,service_role;

-- Bring verified legacy knowledge into the new knowledge brain.
insert into public.dimpho_knowledge_documents(title,source_type,source_ref,content,status,sensitivity,confidence,valid_until,metadata)
select e.title,'legacy_knowledge',e.id::text,e.content,'published','internal',least(1,greatest(0,coalesce(e.confidence,0.85))),e.valid_until,
       jsonb_build_object('legacy_knowledge_key',e.knowledge_key,'structured_data',e.structured_data,'requires_human_confirmation',e.requires_human_confirmation)
from public.adminos_knowledge_entries e
on conflict(source_type,source_ref) do update set title=excluded.title,content=excluded.content,confidence=excluded.confidence,valid_until=excluded.valid_until,metadata=excluded.metadata,updated_at=now();

insert into public.dimpho_knowledge_documents(title,source_type,source_ref,content,status,sensitivity,confidence,metadata)
values(
  'ResKonnect core identity','admin','core:identity',
  'ResKonnect is an Africa-built student journey and accommodation technology platform. Core experiences include Find My Res accommodation discovery, ResMap spatial discovery and navigation, application readiness, accommodation applications, opportunities, WIL support, Career & Education content, referrals and partner operations. Dimpho is the ResKonnect AI Concierge. Live prices, availability, application state and customer-specific facts must always come from trusted backend context rather than model memory.',
  'published','internal',0.99,jsonb_build_object('canonical',true,'release',4)
)
on conflict(source_type,source_ref) do update set content=excluded.content,updated_at=now();

-- ---------------------------------------------------------------------------
-- R4 — App Intelligence Graph
-- ---------------------------------------------------------------------------

create table if not exists public.dimpho_app_sync_runs (
  id uuid primary key default gen_random_uuid(),
  repository text not null default 'entertainmentinnanetclout-cpu/resi-seek-app',
  commit_sha text,
  source text not null default 'scheduled',
  status text not null default 'running' check (status in ('running','succeeded','partial','failed','skipped')),
  routes_found integer not null default 0,
  features_found integer not null default 0,
  workflows_found integer not null default 0,
  artifacts_found integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_dimpho_app_sync_runs_started on public.dimpho_app_sync_runs(started_at desc);

create table if not exists public.dimpho_app_features (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null unique,
  name text not null,
  description text not null,
  audience text[] not null default '{}',
  capabilities text[] not null default '{}',
  requirements text[] not null default '{}',
  common_issues text[] not null default '{}',
  related_feature_keys text[] not null default '{}',
  status text not null default 'active' check (status in ('active','beta','deprecated','hidden')),
  source text not null default 'github_sync',
  metadata jsonb not null default '{}'::jsonb,
  last_seen_commit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dimpho_app_routes (
  id uuid primary key default gen_random_uuid(),
  route_path text not null unique,
  feature_key text,
  page_component text,
  access_level text not null default 'public' check (access_level in ('public','authenticated','staff','admin','partner','recruiter','residence')),
  purpose text,
  user_actions text[] not null default '{}',
  aliases text[] not null default '{}',
  status text not null default 'active' check (status in ('active','redirect','deprecated','hidden')),
  canonical_url text,
  source_file text,
  last_seen_commit text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_dimpho_app_routes_feature on public.dimpho_app_routes(feature_key,status);

create table if not exists public.dimpho_app_workflows (
  id uuid primary key default gen_random_uuid(),
  workflow_key text not null unique,
  name text not null,
  description text not null,
  audience text[] not null default '{}',
  entry_route text,
  success_state text,
  status text not null default 'active' check (status in ('active','beta','deprecated')),
  metadata jsonb not null default '{}'::jsonb,
  last_seen_commit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dimpho_app_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.dimpho_app_workflows(id) on delete cascade,
  step_order integer not null,
  step_key text not null,
  title text not null,
  instruction text not null,
  route_path text,
  requirements text[] not null default '{}',
  backend_checks text[] not null default '{}',
  failure_recovery text,
  metadata jsonb not null default '{}'::jsonb,
  unique(workflow_id,step_order),
  unique(workflow_id,step_key)
);

create table if not exists public.dimpho_code_artifacts (
  id uuid primary key default gen_random_uuid(),
  artifact_key text not null unique,
  artifact_type text not null check (artifact_type in ('route_file','page','component','edge_function','migration','config','manifest')),
  path text not null,
  sha text,
  summary text,
  symbols jsonb not null default '[]'::jsonb,
  last_seen_commit text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dimpho_app_sync_runs enable row level security;
alter table public.dimpho_app_features enable row level security;
alter table public.dimpho_app_routes enable row level security;
alter table public.dimpho_app_workflows enable row level security;
alter table public.dimpho_app_workflow_steps enable row level security;
alter table public.dimpho_code_artifacts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['dimpho_app_sync_runs','dimpho_app_features','dimpho_app_routes','dimpho_app_workflows','dimpho_app_workflow_steps','dimpho_code_artifacts'] loop
    execute format('drop policy if exists "Dimpho staff read %s" on public.%I',t,t);
    execute format('create policy "Dimpho staff read %s" on public.%I for select to authenticated using ((select public.adminos_is_staff()))',t,t);
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;

-- Admins may curate feature/workflow descriptions without changing code-sourced route identity.
drop policy if exists "Dimpho admin curate app features" on public.dimpho_app_features;
create policy "Dimpho admin curate app features" on public.dimpho_app_features for update to authenticated using ((select public.has_role(auth.uid(),'admin'::public.app_role))) with check ((select public.has_role(auth.uid(),'admin'::public.app_role)));
drop policy if exists "Dimpho admin curate app workflows" on public.dimpho_app_workflows;
create policy "Dimpho admin curate app workflows" on public.dimpho_app_workflows for update to authenticated using ((select public.has_role(auth.uid(),'admin'::public.app_role))) with check ((select public.has_role(auth.uid(),'admin'::public.app_role)));
grant update on public.dimpho_app_features,public.dimpho_app_workflows to authenticated;

-- Canonical journey seeds. GitHub sync will enrich routes/components automatically.
insert into public.dimpho_app_features(feature_key,name,description,audience,capabilities,requirements,common_issues,related_feature_keys,source)
values
('find-my-res','Find My Res','Search, compare and open student accommodation listings, with ResMap available as the spatial discovery layer.',array['public','student'],array['search','filter','compare','open residence','apply','share','open ResMap'],array['account required to submit an application'],array['location permission denied','no matching residence','stale filters'],array['resmap','applications','profile'],'seed'),
('resmap','ResMap','Interactive 2D accommodation map with live routing, route-aware real Google Street View and optional full 3D exploration.',array['public','student'],array['map search','live location','route here','LIVE 360 Street View','3D exploration'],array['location permission for live routing','Google coverage for Street View/3D'],array['GPS permission denied','Street View coverage unavailable','3D unsupported on device'],array['find-my-res'],'seed'),
('applications','Applications','Authenticated application tracking and accommodation application workflow.',array['student'],array['start application','track status','view requirements'],array['account','completed profile','required documents'],array['profile incomplete','missing documents','residence review pending'],array['profile','find-my-res'],'seed'),
('profile','Student Profile','Identity, study and contact information required by authenticated student workflows.',array['student'],array['edit profile','manage documents'],array['authenticated account'],array['incomplete required fields'],array['applications'],'seed'),
('opportunities','Opportunities','Discover WIL, bursary and student opportunity content.',array['public','student'],array['browse opportunities','open opportunity','apply where supported'],array[]::text[],array['closing date passed','external application requirements'],array['wil'],'seed'),
('career-education','Career & Education','Public education and career guidance content including the Tumelo partnership section.',array['public'],array['browse education content','watch resources'],array[]::text[],array[]::text[],array['opportunities'],'seed')
on conflict(feature_key) do update set name=excluded.name,description=excluded.description,audience=excluded.audience,capabilities=excluded.capabilities,requirements=excluded.requirements,common_issues=excluded.common_issues,related_feature_keys=excluded.related_feature_keys,updated_at=now();

insert into public.dimpho_app_workflows(workflow_key,name,description,audience,entry_route,success_state,status,metadata)
values
('accommodation-placement','Find and apply for accommodation','Guide a user from discovery to an accommodation application without losing context.',array['student'],'/find','Application submitted or user has a verified next action','active',jsonb_build_object('canonical',true)),
('resmap-route','Navigate to a residence','Guide a user from a selected residence to live routing and optional LIVE 360 Street View.',array['public','student'],'/find?view=map','Active route guidance to the selected residence','active',jsonb_build_object('canonical',true))
on conflict(workflow_key) do update set description=excluded.description,updated_at=now();

with w as (select id from public.dimpho_app_workflows where workflow_key='accommodation-placement')
insert into public.dimpho_app_workflow_steps(workflow_id,step_order,step_key,title,instruction,route_path,requirements,backend_checks,failure_recovery)
select w.id,s.* from w cross join (values
(1,'discover','Discover accommodation','Open Find My Res and identify suitable accommodation.','/find',array[]::text[],array['residence is visible'],null),
(2,'select','Select a residence','Open the residence profile and confirm it matches the user''s needs.',null,array[]::text[],array['residence exists','published data is current'],'Return to Find My Res with preserved filters.'),
(3,'authenticate','Sign in','Authenticate before protected application actions.','/auth',array['account'],array['session valid'],'Return to the originally requested residence after authentication.'),
(4,'profile','Complete profile','Confirm required profile fields and documents.','/profile',array['authenticated'],array['profile completeness','required documents'],'Explain the exact missing field/document rather than restarting the journey.'),
(5,'apply','Submit application','Start or continue the residence application.',null,array['eligible profile'],array['application state','duplicate application check'],'Resume the existing application if one already exists.'),
(6,'track','Track application','Show the verified application status and the next required action.','/applications',array['application exists'],array['application status'],'Escalate only when the backend cannot explain a protected decision.')
) as s(step_order,step_key,title,instruction,route_path,requirements,backend_checks,failure_recovery)
on conflict(workflow_id,step_order) do update set title=excluded.title,instruction=excluded.instruction,route_path=excluded.route_path,requirements=excluded.requirements,backend_checks=excluded.backend_checks,failure_recovery=excluded.failure_recovery;

with w as (select id from public.dimpho_app_workflows where workflow_key='resmap-route')
insert into public.dimpho_app_workflow_steps(workflow_id,step_order,step_key,title,instruction,route_path,requirements,backend_checks,failure_recovery)
select w.id,s.* from w cross join (values
(1,'open-map','Open ResMap','Open the full ResMap from Find My Res.','/find?view=map',array[]::text[],array['selected residence coordinates available'],'Use 2D ResMap even if 3D is unavailable.'),
(2,'location','Enable live location','Request location only when routing is requested.',null,array['location permission'],array['current GPS position'],'Explain browser/device permission recovery if denied.'),
(3,'route','Start route','Generate a route from the current GPS position to the residence.',null,array['origin','destination'],array['route geometry','route steps'],'Retry with current GPS state rather than stale UI state.'),
(4,'streetview','Open LIVE 360','Offer real Google Street View during an active route.',null,array['active route'],array['Google outdoor Street View coverage'],'Keep route navigation available when Street View coverage is unavailable.'),
(5,'arrive','Arrival','Keep the destination pin and arrival state visible.',null,array[]::text[],array['distance to destination'],'Do not hide the destination simply because navigation state changes.')
) as s(step_order,step_key,title,instruction,route_path,requirements,backend_checks,failure_recovery)
on conflict(workflow_id,step_order) do update set title=excluded.title,instruction=excluded.instruction,route_path=excluded.route_path,requirements=excluded.requirements,backend_checks=excluded.backend_checks,failure_recovery=excluded.failure_recovery;

-- ---------------------------------------------------------------------------
-- Conversation-learning capture. Raw message bodies remain in their original
-- governed tables; this queue stores only identifiers until the worker redacts.
-- ---------------------------------------------------------------------------

create or replace function public.dimpho_capture_whatsapp_learning_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce((select learning_enabled from public.dimpho_intelligence_settings where id=1),true) then
    insert into public.dimpho_conversation_events(channel,thread_id,message_id,direction,occurred_at,metadata)
    values('whatsapp',new.thread_id,new.id,new.direction,coalesce(new.received_at,new.sent_at,new.created_at,now()),jsonb_build_object('contact_id',new.contact_id))
    on conflict(channel,message_id) do nothing;
  end if;
  return new;
end; $$;
drop trigger if exists trg_dimpho_capture_whatsapp_learning on public.adminos_whatsapp_messages;
create trigger trg_dimpho_capture_whatsapp_learning after insert on public.adminos_whatsapp_messages for each row execute function public.dimpho_capture_whatsapp_learning_event();

create or replace function public.dimpho_capture_enquiry_learning_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce((select learning_enabled from public.dimpho_intelligence_settings where id=1),true) then
    insert into public.dimpho_conversation_events(channel,thread_id,message_id,direction,occurred_at,metadata)
    values('in_app',new.thread_id,new.id,coalesce(new.direction,new.sender_type),coalesce(new.created_at,now()),jsonb_build_object('sender_type',new.sender_type))
    on conflict(channel,message_id) do nothing;
  end if;
  return new;
end; $$;
drop trigger if exists trg_dimpho_capture_enquiry_learning on public.adminos_enquiry_messages;
create trigger trg_dimpho_capture_enquiry_learning after insert on public.adminos_enquiry_messages for each row execute function public.dimpho_capture_enquiry_learning_event();

create or replace function public.dimpho_capture_email_learning_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce((select learning_enabled from public.dimpho_intelligence_settings where id=1),true) then
    insert into public.dimpho_conversation_events(channel,thread_id,message_id,direction,occurred_at,metadata)
    values('email',new.thread_id,new.id,new.direction,coalesce(new.received_at,new.sent_at,new.created_at,now()),jsonb_build_object('contact_id',new.contact_id))
    on conflict(channel,message_id) do nothing;
  end if;
  return new;
end; $$;
drop trigger if exists trg_dimpho_capture_email_learning on public.adminos_email_messages;
create trigger trg_dimpho_capture_email_learning after insert on public.adminos_email_messages for each row execute function public.dimpho_capture_email_learning_event();

-- Dashboard summary used by AdminOS Intelligence Studio.
create or replace function public.dimpho_intelligence_overview()
returns jsonb
language sql stable security definer set search_path=public as $$
select jsonb_build_object(
  'persona',coalesce((select jsonb_build_object('name',p.name,'role',p.role_title,'active_version',v.version,'published_at',v.published_at) from public.dimpho_personas p left join public.dimpho_persona_versions v on v.id=p.active_version_id where p.persona_key='dimpho'),'{}'::jsonb),
  'knowledge',jsonb_build_object(
    'documents',(select count(*) from public.dimpho_knowledge_documents where status='published'),
    'chunks',(select count(*) from public.dimpho_knowledge_chunks),
    'embedded_chunks',(select count(*) from public.dimpho_knowledge_chunks where embedding is not null),
    'queued_jobs',(select count(*) from public.dimpho_knowledge_jobs where status='queued')
  ),
  'app_intelligence',jsonb_build_object(
    'routes',(select count(*) from public.dimpho_app_routes where status in ('active','redirect')),
    'features',(select count(*) from public.dimpho_app_features where status in ('active','beta')),
    'workflows',(select count(*) from public.dimpho_app_workflows where status in ('active','beta')),
    'last_sync',(select max(completed_at) from public.dimpho_app_sync_runs where status in ('succeeded','partial'))
  ),
  'learning',jsonb_build_object(
    'queued_events',(select count(*) from public.dimpho_conversation_events where status='queued'),
    'lesson_candidates',(select count(*) from public.dimpho_lesson_candidates where status='candidate'),
    'auto_promoted',(select count(*) from public.dimpho_lesson_candidates where auto_promoted=true),
    'training_examples',(select count(*) from public.dimpho_training_examples where active=true)
  ),
  'settings',(select to_jsonb(s)-'updated_by' from public.dimpho_intelligence_settings s where id=1)
); $$;
revoke all on function public.dimpho_intelligence_overview() from public,anon;
grant execute on function public.dimpho_intelligence_overview() to authenticated,service_role;

-- Schedule the worker. The endpoint is intentionally task-limited and rate-limited;
-- it does not expose arbitrary SQL or arbitrary repository selection.
do $$
declare jid bigint;
begin
  for jid in select jobid from cron.job where jobname='dimpho-intelligence-cycle' loop
    perform cron.unschedule(jid);
  end loop;
  perform cron.schedule(
    'dimpho-intelligence-cycle',
    '*/5 * * * *',
    $cron$select net.http_post(
      url := 'https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/dimpho-intelligence-worker',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"action":"cycle","source":"supabase_cron"}'::jsonb,
      timeout_milliseconds := 120000
    );$cron$
  );
end $$;
