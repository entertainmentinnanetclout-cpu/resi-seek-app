revoke execute on function public.enqueue_property_change() from public, anon, authenticated;
revoke execute on function public.enqueue_public_opportunity_change() from public, anon, authenticated;
revoke execute on function public.enqueue_residence_change() from public, anon, authenticated;
revoke execute on function public.enqueue_seo_page_change() from public, anon, authenticated;

create or replace function public.seo_command_center_summary()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_result jsonb;
begin
  v_role := public.get_my_role()::text;
  if v_role not in ('admin','operations_lead','growth_lead','system_operator') then
    raise exception 'not authorized';
  end if;

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
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.seo_command_center_summary() from public;
revoke execute on function public.seo_command_center_summary() from anon;
grant execute on function public.seo_command_center_summary() to authenticated;
