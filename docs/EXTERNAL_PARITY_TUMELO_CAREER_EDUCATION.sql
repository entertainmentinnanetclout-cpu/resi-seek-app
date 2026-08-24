-- ResKonnect External Supabase parity pack
-- Feature: Career & Education with Tumelo
-- Target project: mefjzkhobkltlbmhusdh

create table if not exists public.partner_content (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  partner_name text not null,
  section_title text not null,
  subtitle text,
  social_platform text,
  social_handle text,
  social_url text,
  preview_text text,
  summary text,
  bullet_points jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  cta_label text,
  cta_url text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partner_content enable row level security;

drop policy if exists "Published partner content is publicly readable" on public.partner_content;
create policy "Published partner content is publicly readable"
on public.partner_content
for select
to anon, authenticated
using (is_published = true);

insert into public.partner_content (
  slug,
  partner_name,
  section_title,
  subtitle,
  social_platform,
  social_handle,
  social_url,
  preview_text,
  summary,
  bullet_points,
  tags,
  cta_label,
  cta_url,
  is_published,
  published_at
) values (
  'tumelo-career-education',
  'Tumelo',
  'Career & Education with Tumelo',
  'Trusted guidance on qualifications, applications and education choices — connected directly to your ResKonnect journey.',
  'TikTok',
  '@tumelosithole10',
  'https://www.tiktok.com/@tumelosithole10',
  'Before you apply for any qualification, do your research.',
  'Tumelo shares practical advice for students to make informed decisions before applying for any qualification.',
  '["Before applying for any qualification, do proper research.","Understand what the qualification covers and what career path it leads to.","Check entry requirements and whether you meet them.","Compare institutions or colleges offering the programme.","Look at application opening and closing dates early.","Prepare the required documents before applications open.","Make sure the qualification aligns with your goals, strengths and interests.","Avoid applying blindly simply because a programme sounds popular."]'::jsonb,
  array['TVET guidance','Qualification advice','Application dates','Career research','Documents needed'],
  'Continue on ResKonnect',
  '/get-started',
  true,
  now()
)
on conflict (slug) do update set
  partner_name = excluded.partner_name,
  section_title = excluded.section_title,
  subtitle = excluded.subtitle,
  social_platform = excluded.social_platform,
  social_handle = excluded.social_handle,
  social_url = excluded.social_url,
  preview_text = excluded.preview_text,
  summary = excluded.summary,
  bullet_points = excluded.bullet_points,
  tags = excluded.tags,
  cta_label = excluded.cta_label,
  cta_url = excluded.cta_url,
  is_published = excluded.is_published,
  published_at = coalesce(public.partner_content.published_at, excluded.published_at),
  updated_at = now();
