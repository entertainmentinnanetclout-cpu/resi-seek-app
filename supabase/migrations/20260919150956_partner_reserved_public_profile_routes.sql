-- Keep public directory, onboarding and existing corporate partner routes reachable.
alter table public.rk_partner_profiles
add constraint rk_partner_profiles_reserved_route_slug_check
check (slug not in ('directory','onboarding','landlords','institutions'));
