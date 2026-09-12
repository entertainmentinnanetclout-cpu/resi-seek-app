begin;

-- Post-auth hardening: remove unnecessary write-capability from safe projection
-- views without breaking the intentional privacy boundaries they provide.

alter view public.adminos_residence_readiness_v
  set (security_invoker = true, security_barrier = true);

revoke all on table public.adminos_residence_readiness_v from anon, authenticated;
revoke all on table public.recruitable_residences_v from anon, authenticated;
revoke all on table public.residence_portal_applications_safe from anon, authenticated;
revoke all on table public.residence_portal_leads_safe from anon, authenticated;
revoke all on table public.roommate_profiles_public_v from anon, authenticated;

grant select on table public.adminos_residence_readiness_v to authenticated;
grant select on table public.recruitable_residences_v to authenticated;
grant select on table public.residence_portal_applications_safe to authenticated;
grant select on table public.residence_portal_leads_safe to authenticated;
grant select on table public.roommate_profiles_public_v to anon, authenticated;

-- Permission helper is only consumed by authenticated/admin handover flows and
-- nested privileged RPCs. It should not be callable anonymously as its own RPC.
revoke execute on function public.can_manage_handover_export() from public, anon;
grant execute on function public.can_manage_handover_export() to authenticated;

commit;
