-- Android 1.1.1 release hardening: keep authenticated auth/session helper RPCs off the anonymous API surface.
-- Production ACLs were verified after application: anon=false; authenticated/service_role=true.

revoke all on function public.get_my_access_context() from public, anon;
grant execute on function public.get_my_access_context() to authenticated, service_role;

revoke all on function public.capture_referral_for_current_user(text) from public, anon;
grant execute on function public.capture_referral_for_current_user(text) to authenticated, service_role;

revoke all on function public.get_push_targets(uuid[]) from public, anon;
grant execute on function public.get_push_targets(uuid[]) to authenticated, service_role;
