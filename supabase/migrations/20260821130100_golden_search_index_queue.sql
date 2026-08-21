-- Queue public URL changes for IndexNow submission.

create or replace function public.enqueue_seo_page_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_path text; v_action text;
begin
  v_path:=coalesce(new.path,old.path);
  v_action:=case when tg_op='INSERT' then 'created' when tg_op='DELETE' then 'deleted' else 'updated' end;
  if v_path is not null then insert into public.seo_index_queue(path,action) values(v_path,v_action); end if;
  return coalesce(new,old);
end; $$;

create or replace function public.enqueue_property_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_slug text; v_public boolean; v_action text;
begin
  v_slug:=coalesce(new.slug,old.slug); v_public:=coalesce(new.is_published,false) or coalesce(old.is_published,false);
  v_action:=case when tg_op='INSERT' then 'created' when tg_op='DELETE' then 'deleted' else 'updated' end;
  if v_slug is not null and v_public then
    insert into public.seo_index_queue(path,action) values('/properties/'||v_slug,v_action);
    insert into public.seo_index_queue(path,action) values('/properties','updated');
  end if;
  return coalesce(new,old);
end; $$;

create or replace function public.enqueue_public_opportunity_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_slug text; v_public boolean; v_action text;
begin
  v_slug:=coalesce(new.slug,old.slug); v_public:=coalesce(new.is_published,false) or coalesce(old.is_published,false);
  v_action:=case when tg_op='INSERT' then 'created' when tg_op='DELETE' then 'deleted' else 'updated' end;
  if v_slug is not null and v_public then
    insert into public.seo_index_queue(path,action) values('/opportunities/'||v_slug,v_action);
    insert into public.seo_index_queue(path,action) values('/opportunities','updated');
  end if;
  return coalesce(new,old);
end; $$;

create or replace function public.enqueue_residence_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_slug text; v_visible boolean;
begin
  v_slug:=coalesce(new.slug,old.slug); v_visible:=coalesce(new.is_visible,false) or coalesce(old.is_visible,false);
  if v_slug is not null and v_visible then
    insert into public.seo_index_queue(path,action) values('/find-my-res/'||v_slug,case when tg_op='INSERT' then 'created' when tg_op='DELETE' then 'deleted' else 'updated' end);
    insert into public.seo_index_queue(path,action) values('/find','updated');
    insert into public.seo_index_queue(path,action) values('/student-accommodation','updated');
  end if;
  return coalesce(new,old);
end; $$;

drop trigger if exists seo_pages_index_queue_trg on public.seo_pages;
create trigger seo_pages_index_queue_trg after insert or update or delete on public.seo_pages for each row execute function public.enqueue_seo_page_change();
drop trigger if exists property_opportunities_index_queue_trg on public.property_opportunities;
create trigger property_opportunities_index_queue_trg after insert or update or delete on public.property_opportunities for each row execute function public.enqueue_property_change();
drop trigger if exists public_opportunities_index_queue_trg on public.public_opportunities;
create trigger public_opportunities_index_queue_trg after insert or update or delete on public.public_opportunities for each row execute function public.enqueue_public_opportunity_change();
drop trigger if exists residences_index_queue_trg on public.residences;
create trigger residences_index_queue_trg after insert or update or delete on public.residences for each row execute function public.enqueue_residence_change();

create index if not exists seo_pages_entity_idx on public.seo_pages(entity_type,entity_id);
create index if not exists seo_search_intents_pillar_status_idx on public.seo_search_intents(pillar,status,priority);
create index if not exists seo_entities_location_idx on public.seo_entities(entity_type,province,city) where is_public;
