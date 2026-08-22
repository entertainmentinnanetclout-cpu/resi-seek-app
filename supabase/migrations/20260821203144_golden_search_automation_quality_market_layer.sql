-- Golden Search automation: indexing queue, programmatic quality gate, and privacy-safe market intelligence.

alter table public.seo_pages
  add column if not exists generation_mode text not null default 'curated',
  add column if not exists inventory_count integer not null default 0,
  add column if not exists original_data_points integer not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='seo_pages_generation_mode_check') then
    alter table public.seo_pages add constraint seo_pages_generation_mode_check check (generation_mode in ('curated','programmatic','system'));
  end if;
  if not exists (select 1 from pg_constraint where conname='seo_pages_inventory_count_check') then
    alter table public.seo_pages add constraint seo_pages_inventory_count_check check (inventory_count >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='seo_pages_original_data_points_check') then
    alter table public.seo_pages add constraint seo_pages_original_data_points_check check (original_data_points >= 0);
  end if;
end $$;

create or replace view public.seo_public_pages_v as
with thresholds as (
  select
    coalesce((config_value->>'qualityScore')::int,70) as quality_score,
    coalesce((config_value->>'contentCompleteness')::int,70) as content_completeness,
    coalesce((config_value->>'uniqueDataScore')::int,40) as unique_data_score
  from public.seo_site_config
  where config_key='index_thresholds'
  limit 1
)
select p.id,p.path,p.entity_type,p.entity_id,p.title,p.description,p.h1,p.primary_keyword,p.search_intent,p.canonical_path,
       p.og_title,p.og_description,p.og_image,p.schema_type,p.schema_data,p.breadcrumbs,p.indexable,p.follow_links,
       p.published_at,p.last_verified_at,p.expires_at,p.updated_at,p.answer_summary,p.content_blocks,p.entity_facts,
       p.faq_items,p.cta,p.locale,p.search_territory,p.quality_score,p.unique_data_score,p.content_completeness,p.ai_citation_ready,
       p.generation_mode,p.inventory_count,p.original_data_points
from public.seo_pages p
left join thresholds t on true
where p.indexable
  and p.content_status='published'
  and (p.expires_at is null or p.expires_at > now())
  and (
    p.generation_mode <> 'programmatic'
    or (
      p.quality_score >= coalesce(t.quality_score,70)
      and p.content_completeness >= coalesce(t.content_completeness,70)
      and p.unique_data_score >= coalesce(t.unique_data_score,40)
      and (p.inventory_count >= 3 or p.original_data_points >= 2)
    )
  );

grant select on public.seo_public_pages_v to anon, authenticated;

create or replace view public.seo_programmatic_eligibility_v as
with thresholds as (
  select
    coalesce((config_value->>'qualityScore')::int,70) as quality_score,
    coalesce((config_value->>'contentCompleteness')::int,70) as content_completeness,
    coalesce((config_value->>'uniqueDataScore')::int,40) as unique_data_score
  from public.seo_site_config
  where config_key='index_thresholds'
  limit 1
)
select p.id,p.path,p.generation_mode,p.indexable,p.content_status,p.quality_score,p.content_completeness,p.unique_data_score,
       p.inventory_count,p.original_data_points,
       case when p.generation_mode <> 'programmatic' then true
            else p.quality_score >= coalesce(t.quality_score,70)
             and p.content_completeness >= coalesce(t.content_completeness,70)
             and p.unique_data_score >= coalesce(t.unique_data_score,40)
             and (p.inventory_count >= 3 or p.original_data_points >= 2)
       end as quality_gate_passed
from public.seo_pages p
left join thresholds t on true;

grant select on public.seo_programmatic_eligibility_v to authenticated;

-- Central, deduplicating IndexNow queue helper.
create or replace function public.seo_enqueue_index(p_path text,p_action text default 'updated')
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_path is null or p_path='' then return; end if;
  if p_action not in ('created','updated','deleted') then p_action := 'updated'; end if;
  if not exists (
    select 1 from public.seo_index_queue
    where path=p_path and action=p_action and status in ('pending','processing')
  ) then
    insert into public.seo_index_queue(path,action,engines,status)
    values (p_path,p_action,array['bing_indexnow']::text[],'pending');
  end if;
end;
$$;

revoke all on function public.seo_enqueue_index(text,text) from public;
grant execute on function public.seo_enqueue_index(text,text) to service_role;

create or replace function public.seo_pages_index_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare old_live boolean := false; new_live boolean := false;
begin
  if tg_op <> 'INSERT' then
    old_live := old.indexable and old.content_status='published' and (old.expires_at is null or old.expires_at > now());
  end if;
  if tg_op <> 'DELETE' then
    new_live := new.indexable and new.content_status='published' and (new.expires_at is null or new.expires_at > now());
  end if;
  if tg_op='INSERT' and new_live then perform public.seo_enqueue_index(new.path,'created');
  elsif tg_op='DELETE' and old_live then perform public.seo_enqueue_index(old.path,'deleted');
  elsif tg_op='UPDATE' then
    if old.path is distinct from new.path and old_live then perform public.seo_enqueue_index(old.path,'deleted'); end if;
    if new_live and (not old_live or old.path is distinct from new.path) then perform public.seo_enqueue_index(new.path,'created');
    elsif old_live and not new_live then perform public.seo_enqueue_index(old.path,'deleted');
    elsif new_live and old_live and (
      old.title is distinct from new.title or old.description is distinct from new.description or old.h1 is distinct from new.h1 or
      old.updated_at is distinct from new.updated_at or old.last_verified_at is distinct from new.last_verified_at or
      old.answer_summary is distinct from new.answer_summary or old.content_blocks is distinct from new.content_blocks or
      old.entity_facts is distinct from new.entity_facts or old.schema_data is distinct from new.schema_data
    ) then perform public.seo_enqueue_index(new.path,'updated'); end if;
  end if;
  return coalesce(new,old);
end; $$;

drop trigger if exists trg_seo_pages_index_queue on public.seo_pages;
create trigger trg_seo_pages_index_queue after insert or update or delete on public.seo_pages
for each row execute function public.seo_pages_index_trigger();

create or replace function public.residences_index_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare old_live boolean := false; new_live boolean := false; old_path text; new_path text;
begin
  if tg_op <> 'INSERT' then
    old_live := coalesce(old.is_visible,true) and old.slug is not null and old.slug<>'';
    old_path := case when old.slug is not null then '/find-my-res/'||old.slug else null end;
  end if;
  if tg_op <> 'DELETE' then
    new_live := coalesce(new.is_visible,true) and new.slug is not null and new.slug<>'';
    new_path := case when new.slug is not null then '/find-my-res/'||new.slug else null end;
  end if;
  if tg_op='INSERT' and new_live then perform public.seo_enqueue_index(new_path,'created');
  elsif tg_op='DELETE' and old_live then perform public.seo_enqueue_index(old_path,'deleted');
  elsif tg_op='UPDATE' then
    if old_live and (not new_live or old_path is distinct from new_path) then perform public.seo_enqueue_index(old_path,'deleted'); end if;
    if new_live and (not old_live or old_path is distinct from new_path) then perform public.seo_enqueue_index(new_path,'created');
    elsif new_live and old_live and old_path=new_path and (
      old.name is distinct from new.name or old.price is distinct from new.price or old.available_spots is distinct from new.available_spots or
      old.description is distinct from new.description or old.updated_at is distinct from new.updated_at or old.accepts_nsfas is distinct from new.accepts_nsfas
    ) then perform public.seo_enqueue_index(new_path,'updated'); end if;
  end if;
  return coalesce(new,old);
end; $$;

drop trigger if exists trg_residences_index_queue on public.residences;
create trigger trg_residences_index_queue after insert or update or delete on public.residences
for each row execute function public.residences_index_trigger();

create or replace function public.property_opportunities_index_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare old_live boolean := false; new_live boolean := false; old_path text; new_path text;
begin
  if tg_op <> 'INSERT' then old_live:=old.is_published; old_path:='/properties/'||old.slug; end if;
  if tg_op <> 'DELETE' then new_live:=new.is_published; new_path:='/properties/'||new.slug; end if;
  if tg_op='INSERT' and new_live then perform public.seo_enqueue_index(new_path,'created');
  elsif tg_op='DELETE' and old_live then perform public.seo_enqueue_index(old_path,'deleted');
  elsif tg_op='UPDATE' then
    if old_live and (not new_live or old_path is distinct from new_path) then perform public.seo_enqueue_index(old_path,'deleted'); end if;
    if new_live and (not old_live or old_path is distinct from new_path) then perform public.seo_enqueue_index(new_path,'created');
    elsif new_live and old_live and old_path=new_path and old.updated_at is distinct from new.updated_at then perform public.seo_enqueue_index(new_path,'updated'); end if;
  end if;
  return coalesce(new,old);
end; $$;

drop trigger if exists trg_property_opportunities_index_queue on public.property_opportunities;
create trigger trg_property_opportunities_index_queue after insert or update or delete on public.property_opportunities
for each row execute function public.property_opportunities_index_trigger();

create or replace function public.public_opportunities_index_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare old_live boolean := false; new_live boolean := false; old_path text; new_path text;
begin
  if tg_op <> 'INSERT' then old_live:=old.is_published; old_path:='/opportunity/'||old.slug; end if;
  if tg_op <> 'DELETE' then new_live:=new.is_published; new_path:='/opportunity/'||new.slug; end if;
  if tg_op='INSERT' and new_live then perform public.seo_enqueue_index(new_path,'created');
  elsif tg_op='DELETE' and old_live then perform public.seo_enqueue_index(old_path,'deleted');
  elsif tg_op='UPDATE' then
    if old_live and (not new_live or old_path is distinct from new_path) then perform public.seo_enqueue_index(old_path,'deleted'); end if;
    if new_live and (not old_live or old_path is distinct from new_path) then perform public.seo_enqueue_index(new_path,'created');
    elsif new_live and old_live and old_path=new_path and old.updated_at is distinct from new.updated_at then perform public.seo_enqueue_index(new_path,'updated'); end if;
  end if;
  return coalesce(new,old);
end; $$;

drop trigger if exists trg_public_opportunities_index_queue on public.public_opportunities;
create trigger trg_public_opportunities_index_queue after insert or update or delete on public.public_opportunities
for each row execute function public.public_opportunities_index_trigger();

-- Privacy-safe original-data views. Only public/visible inventory is aggregated.
create or replace view public.public_student_accommodation_market_v as
select
  coalesce(province,'Unknown') as province,
  coalesce(nullif(trim(campus),''),'Unspecified') as campus,
  count(*)::int as residence_count,
  coalesce(sum(capacity),0)::int as advertised_capacity,
  coalesce(sum(greatest(coalesce(available_spots,0),0)),0)::int as advertised_available_spots,
  min(price) filter (where price>0) as min_advertised_price,
  round(avg(price) filter (where price>0),2) as avg_advertised_price,
  max(price) filter (where price>0) as max_advertised_price,
  count(*) filter (where accepts_nsfas)::int as nsfas_accepting_residences,
  count(*) filter (where accepts_private)::int as private_accepting_residences,
  count(*) filter (where coalesce(has_wifi,false))::int as wifi_residences,
  count(*) filter (where coalesce(is_furnished,false))::int as furnished_residences,
  max(updated_at) as data_updated_at
from public.residences
where coalesce(is_visible,true)
group by coalesce(province,'Unknown'),coalesce(nullif(trim(campus),''),'Unspecified');

grant select on public.public_student_accommodation_market_v to anon, authenticated;

create or replace view public.public_property_market_v as
select
  coalesce(province,'Unspecified') as province,
  coalesce(city,'Unspecified') as city,
  count(*)::int as published_opportunities,
  count(*) filter (where lower(opportunity_type) like '%auction%' or lower(status) like '%auction%')::int as auction_opportunities,
  count(*) filter (where advertised_bed_capacity is not null)::int as opportunities_with_bed_capacity,
  round(avg(asking_price) filter (where asking_price>0),2) as avg_asking_price,
  round(avg(asking_price/nullif(advertised_bed_capacity,0)) filter (where asking_price>0 and advertised_bed_capacity>0),2) as avg_asking_cost_per_advertised_bed,
  max(last_verified_at) as last_verified_at
from public.property_opportunities
where is_published
group by coalesce(province,'Unspecified'),coalesce(city,'Unspecified');

grant select on public.public_property_market_v to anon, authenticated;

create or replace view public.public_opportunity_market_v as
select
  opportunity_type,
  coalesce(province,'Unspecified') as province,
  count(*)::int as published_opportunities,
  count(*) filter (where closing_date is null or closing_date >= now())::int as currently_open_or_undated,
  min(closing_date) filter (where closing_date >= now()) as next_closing_date,
  max(last_verified_at) as last_verified_at
from public.public_opportunities
where is_published
group by opportunity_type,coalesce(province,'Unspecified');

grant select on public.public_opportunity_market_v to anon, authenticated;
