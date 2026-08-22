create index if not exists seo_entity_relations_to_entity_idx on public.seo_entity_relations(to_entity_id);
create index if not exists seo_sources_page_id_idx on public.seo_sources(page_id);
create index if not exists seo_redirects_active_source_idx on public.seo_redirects(source_path) where is_active;
create index if not exists public_opportunities_published_type_idx on public.public_opportunities(is_published,opportunity_type,closing_date);
