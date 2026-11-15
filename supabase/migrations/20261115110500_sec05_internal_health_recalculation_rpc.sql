-- SEC-05 / SEC-21: prevent signed-in users bypassing row-level access via
-- a SECURITY DEFINER application-health recalculation RPC.
--
-- Verified live project mefjzkhobkltlbmhusdh, 2026-11-15:
-- The function is owned by postgres and invoked by three SECURITY DEFINER
-- triggers (applications, application_documents, profiles) and an existing
-- service-role-only operations cycle.
-- Every ordinary authenticated user previously had EXECUTE, including users
-- who do not own the referenced application. The function reads internal
-- profiles/documents and returns an internal application-health record.
--
-- Trigger owners remain postgres and service_role retains EXECUTE.
-- Signatures, return type, trigger bodies, customer records and RLS unchanged.
revoke execute on function public.adminos_recalculate_application_health(uuid)
  from public, anon, authenticated;
grant execute on function public.adminos_recalculate_application_health(uuid)
  to service_role;
