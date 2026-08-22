-- Remove superseded queue triggers so each public content change is enqueued exactly once.
drop trigger if exists seo_pages_index_queue_trg on public.seo_pages;
drop trigger if exists property_opportunities_index_queue_trg on public.property_opportunities;
drop trigger if exists public_opportunities_index_queue_trg on public.public_opportunities;
drop trigger if exists residences_index_queue_trg on public.residences;

-- Collapse legacy duplicate pending queue entries before enforcing uniqueness.
with ranked as (
  select id,
         row_number() over (partition by path, action, status order by queued_at desc, id desc) as rn
  from public.seo_index_queue
  where status in ('pending','processing')
)
delete from public.seo_index_queue q
using ranked r
where q.id = r.id and r.rn > 1;

create unique index if not exists seo_index_queue_active_unique_idx
  on public.seo_index_queue(path, action)
  where status in ('pending','processing');

create or replace function public.seo_enqueue_index(p_path text,p_action text default 'updated')
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_path is null or p_path='' then return; end if;
  if p_action not in ('created','updated','deleted') then p_action := 'updated'; end if;
  insert into public.seo_index_queue(path,action,engines,status)
  values (p_path,p_action,array['bing_indexnow']::text[],'pending')
  on conflict do nothing;
end;
$$;

revoke all on function public.seo_enqueue_index(text,text) from public;
grant execute on function public.seo_enqueue_index(text,text) to service_role;

-- The geography migration recreates this view, so restore its public read grant.
grant select on public.public_student_accommodation_market_v to anon, authenticated;
