create table if not exists public.partnership_resources (
  id uuid primary key default gen_random_uuid(),
  partner_slug text not null,
  title text not null,
  description text,
  category text not null default 'resource',
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  is_public boolean not null default true,
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
alter table public.partnership_resources enable row level security;

drop policy if exists "public reads published partnership resources" on public.partnership_resources;
create policy "public reads published partnership resources" on public.partnership_resources for select to anon,authenticated using(is_public=true);
drop policy if exists "partner managers read all resources" on public.partnership_resources;
create policy "partner managers read all resources" on public.partnership_resources for select to authenticated using(public.can_access_partnership(partner_slug));
drop policy if exists "partner managers insert resources" on public.partnership_resources;
create policy "partner managers insert resources" on public.partnership_resources for insert to authenticated with check(created_by=auth.uid() and public.can_access_partnership(partner_slug));
drop policy if exists "partner managers update resources" on public.partnership_resources;
create policy "partner managers update resources" on public.partnership_resources for update to authenticated using(public.can_access_partnership(partner_slug)) with check(public.can_access_partnership(partner_slug));
drop policy if exists "partner managers delete resources" on public.partnership_resources;
create policy "partner managers delete resources" on public.partnership_resources for delete to authenticated using(public.can_access_partnership(partner_slug));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('partnership-resources','partnership-resources',true,20971520,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','image/png','image/jpeg','image/webp','text/plain'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "public partnership resource files" on storage.objects;
create policy "public partnership resource files" on storage.objects for select to anon,authenticated using(bucket_id='partnership-resources');
drop policy if exists "tumelo uploads partnership resources" on storage.objects;
create policy "tumelo uploads partnership resources" on storage.objects for insert to authenticated with check(bucket_id='partnership-resources' and (storage.foldername(name))[1]='tumelo-career-education' and public.can_access_partnership('tumelo-career-education'));
drop policy if exists "tumelo updates partnership resources" on storage.objects;
create policy "tumelo updates partnership resources" on storage.objects for update to authenticated using(bucket_id='partnership-resources' and (storage.foldername(name))[1]='tumelo-career-education' and public.can_access_partnership('tumelo-career-education')) with check(bucket_id='partnership-resources' and (storage.foldername(name))[1]='tumelo-career-education' and public.can_access_partnership('tumelo-career-education'));
drop policy if exists "tumelo deletes partnership resources" on storage.objects;
create policy "tumelo deletes partnership resources" on storage.objects for delete to authenticated using(bucket_id='partnership-resources' and (storage.foldername(name))[1]='tumelo-career-education' and public.can_access_partnership('tumelo-career-education'));

create or replace function public.touch_partnership_resource() returns trigger language plpgsql as $$ begin new.updated_at=now(); if new.is_public and new.published_at is null then new.published_at=now(); end if; return new; end $$;
drop trigger if exists trg_touch_partnership_resource on public.partnership_resources;
create trigger trg_touch_partnership_resource before update on public.partnership_resources for each row execute function public.touch_partnership_resource();
