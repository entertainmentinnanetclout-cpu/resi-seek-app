-- Gold Security targeted RPC exposure cleanup.
-- Preserve intentional public telemetry/public utility RPCs; remove anonymous
-- execution from staff/admin and model-management surfaces.

revoke all on function public.automation_command_center() from public,anon;
grant execute on function public.automation_command_center() to authenticated,service_role;

revoke all on function public.dimpho_latest_eval_gate(text) from public,anon,authenticated;
grant execute on function public.dimpho_latest_eval_gate(text) to service_role;
revoke all on function public.dimpho_model_router_snapshot(text) from public,anon,authenticated;
grant execute on function public.dimpho_model_router_snapshot(text) to service_role;

revoke all on function public.handover_bulk_set_funding(uuid[],text) from public,anon;
grant execute on function public.handover_bulk_set_funding(uuid[],text) to authenticated,service_role;
revoke all on function public.handover_get_record(uuid) from public,anon;
grant execute on function public.handover_get_record(uuid) to authenticated,service_role;
revoke all on function public.handover_integrity_issue_rows_internal(uuid,text) from public,anon,authenticated;
grant execute on function public.handover_integrity_issue_rows_internal(uuid,text) to service_role;
revoke all on function public.handover_integrity_issue_rows_internal_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.handover_integrity_issue_rows_internal_v1(uuid,text) to service_role;
revoke all on function public.handover_integrity_scan(uuid,text) from public,anon;
grant execute on function public.handover_integrity_scan(uuid,text) to authenticated,service_role;
revoke all on function public.handover_quarantine_summary() from public,anon;
grant execute on function public.handover_quarantine_summary() to authenticated,service_role;
revoke all on function public.handover_release_quarantine(uuid) from public,anon;
grant execute on function public.handover_release_quarantine(uuid) to authenticated,service_role;
revoke all on function public.handover_safe_auto_repair(uuid) from public,anon;
grant execute on function public.handover_safe_auto_repair(uuid) to authenticated,service_role;
revoke all on function public.handover_update_record(uuid,jsonb) from public,anon;
grant execute on function public.handover_update_record(uuid,jsonb) to authenticated,service_role;
revoke all on function public.prepare_handover_export(uuid,text) from public,anon;
grant execute on function public.prepare_handover_export(uuid,text) to authenticated,service_role;

-- Authenticated-only identity/authorization helpers should not be callable by
-- unauthenticated clients. Predicate helpers that are required by anonymous RLS
-- are intentionally left unchanged.
revoke all on function public.get_user_residence_id() from public,anon;
grant execute on function public.get_user_residence_id() to authenticated,service_role;

-- Existing public telemetry boundaries intentionally remain callable:
-- capture_referral_click, capture_residence_referral_click, get_referral_public,
-- luna_capture_attribution, luna_log_demand_event, record_virtual_tour_event,
-- virtual_tour_public_snapshot, virtual_tour_marketplace_index and discount validation.
