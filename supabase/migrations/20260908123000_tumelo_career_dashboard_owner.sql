-- Tumelo Career & Education owner dashboard
-- Uses partnership membership instead of student or God Mode application roles.

create or replace function public.get_my_partnership_role(p_slug text)
returns text
language sql
stable
security definer
set search_path=''
set row_security='off'
as $$
  select pm.role
  from public.partnership_memberships pm
  join public.partnerships p on p.id=pm.partnership_id
  where p.slug=p_slug
    and pm.user_id=auth.uid()
    and pm.is_active
  limit 1
$$;
revoke all on function public.get_my_partnership_role(text) from public,anon;
grant execute on function public.get_my_partnership_role(text) to authenticated;

create or replace function public.can_manage_partnership(p_slug text)
returns boolean
language sql
stable
security definer
set search_path=''
set row_security='off'
as $$
  select public.can_manage_growth() or exists (
    select 1
    from public.partnership_memberships pm
    join public.partnerships p on p.id=pm.partnership_id
    where p.slug=p_slug
      and pm.user_id=auth.uid()
      and pm.is_active
      and pm.role in ('owner','strategist')
  )
$$;
revoke all on function public.can_manage_partnership(text) from public,anon;
grant execute on function public.can_manage_partnership(text) to authenticated;

-- Tumelo can read all of the records used by her editor, including temporarily hidden content.
drop policy if exists "tumelo partnership reads own content" on public.partner_content;
create policy "tumelo partnership reads own content"
on public.partner_content for select to authenticated
using (slug='tumelo-career-education' and public.can_access_partnership('tumelo-career-education'));

drop policy if exists "tumelo partnership updates own content" on public.partner_content;
create policy "tumelo partnership updates own content"
on public.partner_content for update to authenticated
using (slug='tumelo-career-education' and public.can_manage_partnership('tumelo-career-education'))
with check (slug='tumelo-career-education' and public.can_manage_partnership('tumelo-career-education'));

drop policy if exists "tumelo partnership reads own provider" on public.career_education_providers;
create policy "tumelo partnership reads own provider"
on public.career_education_providers for select to authenticated
using (slug='tumelo' and public.can_access_partnership('tumelo-career-education'));

drop policy if exists "tumelo partnership updates own provider" on public.career_education_providers;
create policy "tumelo partnership updates own provider"
on public.career_education_providers for update to authenticated
using (slug='tumelo' and public.can_manage_partnership('tumelo-career-education'))
with check (slug='tumelo' and public.can_manage_partnership('tumelo-career-education'));

drop policy if exists "tumelo partnership reads own videos" on public.partner_videos;
create policy "tumelo partnership reads own videos"
on public.partner_videos for select to authenticated
using (provider_slug='tumelo' and public.can_access_partnership('tumelo-career-education'));

drop policy if exists "tumelo partnership inserts own videos" on public.partner_videos;
create policy "tumelo partnership inserts own videos"
on public.partner_videos for insert to authenticated
with check (provider_slug='tumelo' and public.can_manage_partnership('tumelo-career-education'));

drop policy if exists "tumelo partnership updates own videos" on public.partner_videos;
create policy "tumelo partnership updates own videos"
on public.partner_videos for update to authenticated
using (provider_slug='tumelo' and public.can_manage_partnership('tumelo-career-education'))
with check (provider_slug='tumelo' and public.can_manage_partnership('tumelo-career-education'));

drop policy if exists "tumelo partnership deletes own videos" on public.partner_videos;
create policy "tumelo partnership deletes own videos"
on public.partner_videos for delete to authenticated
using (provider_slug='tumelo' and public.can_manage_partnership('tumelo-career-education'));

-- Partnership resource readers can remain viewers; mutations require owner/strategist.
drop policy if exists "partner managers insert resources" on public.partnership_resources;
create policy "partner managers insert resources"
on public.partnership_resources for insert to authenticated
with check (created_by=auth.uid() and public.can_manage_partnership(partner_slug));

drop policy if exists "partner managers update resources" on public.partnership_resources;
create policy "partner managers update resources"
on public.partnership_resources for update to authenticated
using (public.can_manage_partnership(partner_slug))
with check (public.can_manage_partnership(partner_slug));

drop policy if exists "partner managers delete resources" on public.partnership_resources;
create policy "partner managers delete resources"
on public.partnership_resources for delete to authenticated
using (public.can_manage_partnership(partner_slug));

-- Storage writes are limited to the Tumelo partnership folder and managing members.
drop policy if exists "tumelo uploads partnership resources" on storage.objects;
create policy "tumelo uploads partnership resources"
on storage.objects for insert to authenticated
with check (
  bucket_id='partnership-resources'
  and (storage.foldername(name))[1]='tumelo-career-education'
  and public.can_manage_partnership('tumelo-career-education')
);

drop policy if exists "tumelo updates partnership resources" on storage.objects;
create policy "tumelo updates partnership resources"
on storage.objects for update to authenticated
using (
  bucket_id='partnership-resources'
  and (storage.foldername(name))[1]='tumelo-career-education'
  and public.can_manage_partnership('tumelo-career-education')
)
with check (
  bucket_id='partnership-resources'
  and (storage.foldername(name))[1]='tumelo-career-education'
  and public.can_manage_partnership('tumelo-career-education')
);

drop policy if exists "tumelo deletes partnership resources" on storage.objects;
create policy "tumelo deletes partnership resources"
on storage.objects for delete to authenticated
using (
  bucket_id='partnership-resources'
  and (storage.foldername(name))[1]='tumelo-career-education'
  and public.can_manage_partnership('tumelo-career-education')
);
