-- This is an additive hardening follow-up to 20261124054855.
-- The public Edge Function reads the public VAPID key using a server-only role.
-- Never allow browsers to invoke any Vault-reading SECURITY DEFINER RPC.
revoke all on function public.rk_web_push_public_key() from public, anon, authenticated, service_role;
grant execute on function public.rk_web_push_public_key() to service_role;
