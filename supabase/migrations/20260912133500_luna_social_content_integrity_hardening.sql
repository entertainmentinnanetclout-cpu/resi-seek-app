-- Luna social/content hardening for manual publishing mode.
-- 1) Canonicalize ResKonnect URLs at the database boundary.
-- 2) Reconcile content-cycle runs affected by the historical completed/succeeded mismatch.

create or replace function public.canonicalize_reskonnect_social_post()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.caption is not null then
    new.caption := replace(replace(replace(replace(
      new.caption,
      'https://www.reskonnect.co.za','https://www.reskonnect.org'),
      'https://reskonnect.co.za','https://www.reskonnect.org'),
      'http://www.reskonnect.co.za','https://www.reskonnect.org'),
      'http://reskonnect.co.za','https://www.reskonnect.org');
  end if;
  if new.title is not null then
    new.title := replace(replace(replace(replace(
      new.title,
      'https://www.reskonnect.co.za','https://www.reskonnect.org'),
      'https://reskonnect.co.za','https://www.reskonnect.org'),
      'http://www.reskonnect.co.za','https://www.reskonnect.org'),
      'http://reskonnect.co.za','https://www.reskonnect.org');
  end if;
  if new.payload is not null then
    new.payload := replace(replace(replace(replace(
      new.payload::text,
      'https://www.reskonnect.co.za','https://www.reskonnect.org'),
      'https://reskonnect.co.za','https://www.reskonnect.org'),
      'http://www.reskonnect.co.za','https://www.reskonnect.org'),
      'http://reskonnect.co.za','https://www.reskonnect.org')::jsonb;
  end if;
  return new;
end $$;

revoke all on function public.canonicalize_reskonnect_social_post() from public,anon,authenticated;

drop trigger if exists trg_canonicalize_reskonnect_social_post on public.adminos_social_posts;
create trigger trg_canonicalize_reskonnect_social_post
before insert or update on public.adminos_social_posts
for each row execute function public.canonicalize_reskonnect_social_post();

update public.adminos_social_posts
set caption=replace(replace(replace(replace(coalesce(caption,''),
  'https://www.reskonnect.co.za','https://www.reskonnect.org'),
  'https://reskonnect.co.za','https://www.reskonnect.org'),
  'http://www.reskonnect.co.za','https://www.reskonnect.org'),
  'http://reskonnect.co.za','https://www.reskonnect.org'),
  title=replace(replace(replace(replace(coalesce(title,''),
  'https://www.reskonnect.co.za','https://www.reskonnect.org'),
  'https://reskonnect.co.za','https://www.reskonnect.org'),
  'http://www.reskonnect.co.za','https://www.reskonnect.org'),
  'http://reskonnect.co.za','https://www.reskonnect.org'),
  payload=replace(replace(replace(replace(payload::text,
  'https://www.reskonnect.co.za','https://www.reskonnect.org'),
  'https://reskonnect.co.za','https://www.reskonnect.org'),
  'http://www.reskonnect.co.za','https://www.reskonnect.org'),
  'http://reskonnect.co.za','https://www.reskonnect.org')::jsonb
where coalesce(caption,'') ilike '%reskonnect.co.za%'
   or coalesce(title,'') ilike '%reskonnect.co.za%'
   or payload::text ilike '%reskonnect.co.za%';

update public.adminos_agent_runs r
set status='succeeded',
    output=jsonb_build_object(
      'reconciled',true,
      'reason','historical content-cycle status compatibility repair',
      'manual_publish_required',true
    ),
    completed_at=coalesce(r.completed_at,now())
where r.agent_key='luna_content'
  and r.trigger_type='content_cycle'
  and r.status='running'
  and r.started_at < now()-interval '2 minutes'
  and exists (
    select 1 from public.adminos_content_plans p
    where p.generated_by='luna_content'
      and p.created_at between r.started_at and r.started_at+interval '10 minutes'
  );

comment on function public.canonicalize_reskonnect_social_post() is
'Canonicalizes ResKonnect social copy and payload links to https://www.reskonnect.org before persistence.';
