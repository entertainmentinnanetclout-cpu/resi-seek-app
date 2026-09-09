-- God Mode manages plan assignments; residence operators may only read their own residence entitlement.
drop policy if exists virtual_tour_entitlements_admin_all on public.virtual_tour_entitlements;
create policy virtual_tour_entitlements_admin_all
on public.virtual_tour_entitlements
for all to authenticated
using (public.virtual_tour_is_admin())
with check (public.virtual_tour_is_admin());

drop policy if exists virtual_tour_entitlements_residence_read on public.virtual_tour_entitlements;
create policy virtual_tour_entitlements_residence_read
on public.virtual_tour_entitlements
for select to authenticated
using (public.virtual_tour_can_manage_residence(residence_id));
