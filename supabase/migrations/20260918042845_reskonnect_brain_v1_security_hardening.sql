revoke execute on function public.rk_brain_sync_legacy_memory() from public, anon, authenticated;
comment on function public.rk_brain_sync_legacy_memory() is 'Internal trigger function only; direct API execution is revoked.';
comment on function public.rk_brain_overview() is 'Staff-only Brain telemetry RPC. SECURITY DEFINER is intentional and guarded by get_user_staff_role(auth.uid()).';
