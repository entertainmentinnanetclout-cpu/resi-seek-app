do $$ begin
  create policy "staff manage seo aliases" on public.seo_entity_aliases for all to authenticated using (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator')) with check (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff manage seo relations" on public.seo_entity_relations for all to authenticated using (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator')) with check (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff manage seo sources" on public.seo_sources for all to authenticated using (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator')) with check (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff manage seo queue" on public.seo_index_queue for all to authenticated using (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator')) with check (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff manage seo audit" on public.seo_audit_log for all to authenticated using (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator')) with check (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff manage seo metrics" on public.seo_page_metrics for all to authenticated using (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator')) with check (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "staff read all seo intents" on public.seo_search_intents for select to authenticated using (public.get_my_role()::text in ('admin','operations_lead','growth_lead','system_operator'));
exception when duplicate_object then null; end $$;

create or replace function public.seo_command_center_summary()
returns jsonb
language sql
security definer
set search_path=public
as $$
select jsonb_build_object(
  'pages_total', (select count(*) from seo_pages),
  'pages_indexable', (select count(*) from seo_pages where indexable and content_status='published'),
  'intents_total', (select count(*) from seo_search_intents where status <> 'retired'),
  'intents_covered', (select count(*) from seo_search_intents where status='covered'),
  'critical_intents_uncovered', (select count(*) from seo_search_intents where priority='critical' and status <> 'covered'),
  'properties_published', (select count(*) from property_opportunities where is_published),
  'opportunities_published', (select count(*) from public_opportunities where is_published),
  'queue_pending', (select count(*) from seo_index_queue where status='pending'),
  'audit_critical_open', (select count(*) from seo_audit_log where severity='critical' and resolved_at is null)
);
$$;
revoke all on function public.seo_command_center_summary() from public;
grant execute on function public.seo_command_center_summary() to authenticated;
