-- Production migration 20261124054855: web push signing credentials in encrypted Supabase Vault.
-- Provision secret 'rk_push_vapid_pair_v1' separately through the Vault interface.
-- Never commit the VAPID private key or grant access to rk_web_push_server_keys to browsers.

create or replace function public.rk_web_push_public_key()
returns text language sql stable security definer set search_path = ''
as $$
 select nullif((s.decrypted_secret::jsonb ->> 'publicKey'), '')
 from vault.decrypted_secrets s
 where s.name = 'rk_push_vapid_pair_v1'
 limit 1
$$;
revoke all on function public.rk_web_push_public_key() from public, anon, authenticated, service_role;
grant execute on function public.rk_web_push_public_key() to anon, authenticated, service_role;
comment on function public.rk_web_push_public_key() is 'Returns only the public VAPID P-256 key; never returns private material.';

create or replace function public.rk_web_push_server_keys()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
 if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
   raise exception 'Web push credentials are service-role only' using errcode='42501';
 end if;
 select s.decrypted_secret::jsonb into result
 from vault.decrypted_secrets s
 where s.name = 'rk_push_vapid_pair_v1'
 limit 1;
 return result;
end;
$$;
revoke all on function public.rk_web_push_server_keys() from public, anon, authenticated, service_role;
grant execute on function public.rk_web_push_server_keys() to service_role;
comment on function public.rk_web_push_server_keys() is 'Encrypted Vault credential read for trusted server-side Edge sender only. NEVER grant to anon or authenticated.';
