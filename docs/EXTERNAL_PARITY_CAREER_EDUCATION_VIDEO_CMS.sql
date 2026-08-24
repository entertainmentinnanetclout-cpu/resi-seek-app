-- External Supabase parity: Career & Education hub + partner video CMS
-- Target production project: mefjzkhobkltlbmhusdh

create table if not exists public.career_education_providers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  role_label text not null default 'Career & Education',
  bio text,
  profile_image_url text,
  profile_page_path text not null,
  social_handle text,
  social_url text,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_videos (
  id uuid primary key default gen_random_uuid(),
  provider_slug text not null references public.career_education_providers(slug) on update cascade on delete cascade,
  title text not null,
  platform text not null default 'tiktok' check (platform in ('tiktok','youtube','instagram','other')),
  video_url text,
  thumbnail_url text,
  transcript text,
  transcript_points jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_career_education_providers_public on public.career_education_providers(is_published, sort_order);
create index if not exists idx_partner_videos_provider_public on public.partner_videos(provider_slug, is_published, is_featured, sort_order);

alter table public.career_education_providers enable row level security;
alter table public.partner_videos enable row level security;

drop policy if exists "career education providers public read" on public.career_education_providers;
create policy "career education providers public read" on public.career_education_providers for select to anon, authenticated using (is_published = true);

drop policy if exists "partner videos public read" on public.partner_videos;
create policy "partner videos public read" on public.partner_videos for select to anon, authenticated using (is_published = true);

drop policy if exists "career education providers staff manage" on public.career_education_providers;
create policy "career education providers staff manage" on public.career_education_providers for all to authenticated using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text in ('admin','super_admin','developer','owner','growth_lead'))
) with check (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text in ('admin','super_admin','developer','owner','growth_lead'))
);

drop policy if exists "partner videos staff manage" on public.partner_videos;
create policy "partner videos staff manage" on public.partner_videos for all to authenticated using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text in ('admin','super_admin','developer','owner','growth_lead'))
) with check (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text in ('admin','super_admin','developer','owner','growth_lead'))
);

insert into public.career_education_providers (slug, name, role_label, bio, profile_page_path, social_handle, social_url, is_featured, is_published, sort_order)
values ('tumelo','Tumelo','Career & Education','Trusted guidance on qualifications, applications, career choices and student opportunities.','/career-education/tumelo','@tumelosithole10','https://www.tiktok.com/@tumelosithole10',true,true,0)
on conflict (slug) do update set
  name=excluded.name,
  role_label=excluded.role_label,
  bio=excluded.bio,
  profile_page_path=excluded.profile_page_path,
  social_handle=excluded.social_handle,
  social_url=excluded.social_url,
  is_featured=excluded.is_featured,
  is_published=excluded.is_published,
  sort_order=excluded.sort_order,
  updated_at=now();
