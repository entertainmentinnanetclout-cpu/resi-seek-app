-- Anonymous visitors can read published public profiles, but cannot execute staff-authorization helpers.
drop policy if exists rk_partner_public_read on public.rk_partner_profiles;
create policy rk_partner_public_anon_read on public.rk_partner_profiles
 for select to anon using(status='published');
create policy rk_partner_auth_read on public.rk_partner_profiles
 for select to authenticated using(status='published' or user_id=auth.uid() or public.rk_partner_staff(kind));
revoke execute on function public.rk_partner_staff(text) from anon;
