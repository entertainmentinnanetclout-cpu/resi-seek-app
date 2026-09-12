-- Luna AgentOS RG0-RG2 security gate
-- Trigger functions are never client RPCs; demand aggregation is orchestrator-only.

revoke all on function public.luna_attribute_application() from public, anon, authenticated;
revoke all on function public.luna_attribute_placement() from public, anon, authenticated;
revoke all on function public.dimpho_capture_enquiry_learning_event() from public, anon, authenticated;
grant execute on function public.luna_attribute_application() to service_role;
grant execute on function public.luna_attribute_placement() to service_role;
grant execute on function public.dimpho_capture_enquiry_learning_event() to service_role;

revoke all on function public.luna_demand_event_summary(integer) from public, anon, authenticated;
grant execute on function public.luna_demand_event_summary(integer) to service_role;

-- These two SECURITY DEFINER RPCs are intentionally callable by anon/authenticated:
-- luna_capture_attribution(...) and luna_log_demand_event(...).
-- They are the constrained public telemetry boundary. Direct table writes stay revoked,
-- campaign codes are registry-validated, payload arrays/numerics are bounded, and no
-- private data is returned by either function.
