-- Department-scoped reviewers need pending account visibility; this is not a student-case entitlement.
create policy rk_application_admin_read_partner_registrations
on public.creator_partners for select to authenticated
using (partner_kind='application' and public.rk_partner_staff('application'));
create policy rk_residence_admin_read_recruiter_registrations
on public.recruiter_applications for select to authenticated
using (public.rk_partner_staff('residence'));
