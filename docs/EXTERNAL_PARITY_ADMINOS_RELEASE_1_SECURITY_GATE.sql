-- AdminOS Release 1 security gate
-- Removes direct RPC execution from trigger-only SECURITY DEFINER functions and hardens search paths.

create or replace function public.adminos_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- RLS uses the existing staff-role resolver directly, so the AdminOS helper does not need client RPC access.
do $$ declare t text; begin
  foreach t in array array[
    'adminos_agent_config','adminos_agent_runs','adminos_agent_actions','adminos_agent_errors','adminos_approval_requests','adminos_approval_actions',
    'adminos_integration_connections','adminos_integration_health','adminos_knowledge_sources','adminos_knowledge_entries','adminos_audit_events',
    'adminos_consents','adminos_communication_preferences','adminos_contacts','adminos_contact_channels','adminos_organizations','adminos_organization_contacts',
    'adminos_tags','adminos_contact_tags','adminos_prospects','adminos_lead_scores','adminos_automation_rules','adminos_automation_events',
    'adminos_automation_jobs','adminos_automation_runs','adminos_automation_failures','adminos_followup_sequences','adminos_followup_steps','adminos_followup_enrollments'
  ] loop
    execute format('drop policy if exists "AdminOS staff access" on public.%I',t);
    execute format('create policy "AdminOS staff access" on public.%I for all to authenticated using (public.get_user_staff_role(auth.uid()) is not null) with check (public.get_user_staff_role(auth.uid()) is not null)',t);
  end loop;
end $$;

-- Trigger functions execute through their triggers only; they are not public RPC endpoints.
revoke all on function public.adminos_sync_profile_contact() from public, anon, authenticated;
revoke all on function public.adminos_event_dispatch_trigger() from public, anon, authenticated;
revoke all on function public.adminos_execute_safe_job() from public, anon, authenticated;
revoke all on function public.adminos_application_event() from public, anon, authenticated;
revoke all on function public.adminos_prospect_event() from public, anon, authenticated;
revoke all on function public.adminos_touch_updated_at() from public, anon, authenticated;

-- Internal helpers are backend-only in Release 1.
revoke all on function public.adminos_is_staff() from public, anon, authenticated;
revoke all on function public.adminos_is_admin() from public, anon, authenticated;
grant execute on function public.adminos_is_staff() to service_role;
grant execute on function public.adminos_is_admin() to service_role;

-- Explicit backend grants for callable orchestration helpers.
revoke all on function public.adminos_resolve_contact(text,text,text,uuid,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.adminos_resolve_contact(text,text,text,uuid,text,uuid,jsonb) to service_role;
revoke all on function public.adminos_dispatch_event(uuid) from public, anon, authenticated;
grant execute on function public.adminos_dispatch_event(uuid) to service_role;
