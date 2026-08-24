-- External Supabase parity for Career & Education admin editing.
-- Production project migration already applied on 2026-08-24.

drop policy if exists "partner content staff manage" on public.partner_content;
create policy "partner content staff manage"
on public.partner_content
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('admin','super_admin','developer','owner','growth_lead')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('admin','super_admin','developer','owner','growth_lead')
  )
);
