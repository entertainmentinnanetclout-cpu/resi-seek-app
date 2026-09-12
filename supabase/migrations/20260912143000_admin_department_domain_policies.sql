-- Department-aware least-privilege policies for the redesigned Admin God Mode.
-- Department assignment grants only the domain rights required by that office.

create or replace function public.can_manage_accommodation_reservations()
returns boolean
language sql stable security definer
set search_path='' set row_security=off
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id=auth.uid() and ur.role::text in ('admin','operations_lead','support_agent','growth_lead')
  )
  or public.has_admin_department_access('accommodation');
$$;

create or replace function public.can_manage_growth()
returns boolean
language sql stable security definer
set search_path='' set row_security=off
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id=auth.uid() and ur.role::text in ('admin','growth_lead','operations_lead','system_operator')
  )
  or public.has_admin_department_access('marketing_corporate_affairs')
  or public.has_admin_department_access('partnerships_engagements');
$$;

create or replace function public.can_manage_site_content()
returns boolean
language sql stable security definer
set search_path='' set row_security=off
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id=auth.uid() and ur.role::text in ('admin','growth_lead','system_operator')
  )
  or public.has_admin_department_access('marketing_corporate_affairs');
$$;

-- Accommodation Department
drop policy if exists department_accommodation_applications_read on public.applications;
create policy department_accommodation_applications_read on public.applications
for select to authenticated using (public.has_admin_department_access('accommodation'));
drop policy if exists department_accommodation_applications_update on public.applications;
create policy department_accommodation_applications_update on public.applications
for update to authenticated using (public.has_admin_department_access('accommodation'))
with check (public.has_admin_department_access('accommodation'));

drop policy if exists department_accommodation_documents_read on public.documents;
create policy department_accommodation_documents_read on public.documents
for select to authenticated using (public.has_admin_department_access('accommodation'));
drop policy if exists department_accommodation_documents_update on public.documents;
create policy department_accommodation_documents_update on public.documents
for update to authenticated using (public.has_admin_department_access('accommodation'))
with check (public.has_admin_department_access('accommodation'));

drop policy if exists department_accommodation_residences_manage on public.residences;
create policy department_accommodation_residences_manage on public.residences
for all to authenticated using (public.has_admin_department_access('accommodation'))
with check (public.has_admin_department_access('accommodation'));

drop policy if exists department_accommodation_inventory_manage on public.residence_academic_inventory;
create policy department_accommodation_inventory_manage on public.residence_academic_inventory
for all to authenticated using (public.has_admin_department_access('accommodation'))
with check (public.has_admin_department_access('accommodation'));

drop policy if exists department_accommodation_periods_manage on public.academic_periods;
create policy department_accommodation_periods_manage on public.academic_periods
for all to authenticated using (public.has_admin_department_access('accommodation'))
with check (public.has_admin_department_access('accommodation'));

drop policy if exists department_accommodation_reservations_insert on public.accommodation_reservations;
create policy department_accommodation_reservations_insert on public.accommodation_reservations
for insert to authenticated with check (public.has_admin_department_access('accommodation'));

-- Student Services & Opportunities
drop policy if exists department_opportunities_application_hub_manage on public.application_hub_institutions;
create policy department_opportunities_application_hub_manage on public.application_hub_institutions
for all to authenticated using (public.has_admin_department_access('student_opportunities'))
with check (public.has_admin_department_access('student_opportunities'));

drop policy if exists department_opportunities_support_read on public.application_support_queries;
create policy department_opportunities_support_read on public.application_support_queries
for select to authenticated using (
  public.has_admin_department_access('student_opportunities')
  or public.has_admin_department_access('operations')
);
drop policy if exists department_opportunities_support_update on public.application_support_queries;
create policy department_opportunities_support_update on public.application_support_queries
for update to authenticated using (
  public.has_admin_department_access('student_opportunities')
  or public.has_admin_department_access('operations')
) with check (
  public.has_admin_department_access('student_opportunities')
  or public.has_admin_department_access('operations')
);

drop policy if exists department_opportunities_wil_read on public.wil_applications;
create policy department_opportunities_wil_read on public.wil_applications
for select to authenticated using (public.has_admin_department_access('student_opportunities'));
drop policy if exists department_opportunities_wil_update on public.wil_applications;
create policy department_opportunities_wil_update on public.wil_applications
for update to authenticated using (public.has_admin_department_access('student_opportunities'))
with check (public.has_admin_department_access('student_opportunities'));

drop policy if exists department_opportunities_wil_docs_read on public.wil_documents;
create policy department_opportunities_wil_docs_read on public.wil_documents
for select to authenticated using (public.has_admin_department_access('student_opportunities'));

drop policy if exists department_opportunities_wil_notes_manage on public.wil_admin_notes;
create policy department_opportunities_wil_notes_manage on public.wil_admin_notes
for all to authenticated using (public.has_admin_department_access('student_opportunities'))
with check (public.has_admin_department_access('student_opportunities'));

drop policy if exists department_opportunities_bursaries_manage on public.bursaries;
create policy department_opportunities_bursaries_manage on public.bursaries
for all to authenticated using (public.has_admin_department_access('student_opportunities'))
with check (public.has_admin_department_access('student_opportunities'));

drop policy if exists department_opportunities_tvet_applications_read on public.applications;
create policy department_opportunities_tvet_applications_read on public.applications
for select to authenticated using (
  institution_type='tvet' and public.has_admin_department_access('student_opportunities')
);

-- Marketing & Corporate Affairs
drop policy if exists department_corporate_hero_slides_manage on public.hero_slides;
create policy department_corporate_hero_slides_manage on public.hero_slides
for all to authenticated using (public.has_admin_department_access('marketing_corporate_affairs'))
with check (public.has_admin_department_access('marketing_corporate_affairs'));

drop policy if exists department_corporate_news_manage on public.campus_news;
create policy department_corporate_news_manage on public.campus_news
for all to authenticated using (public.has_admin_department_access('marketing_corporate_affairs'))
with check (public.has_admin_department_access('marketing_corporate_affairs'));

drop policy if exists department_corporate_events_manage on public.events;
create policy department_corporate_events_manage on public.events
for all to authenticated using (public.has_admin_department_access('marketing_corporate_affairs'))
with check (public.has_admin_department_access('marketing_corporate_affairs'));

drop policy if exists department_corporate_marketplace_banners_manage on public.marketplace_banners;
create policy department_corporate_marketplace_banners_manage on public.marketplace_banners
for all to authenticated using (public.has_admin_department_access('marketing_corporate_affairs'))
with check (public.has_admin_department_access('marketing_corporate_affairs'));

drop policy if exists department_corporate_category_cards_manage on public.category_card_configs;
create policy department_corporate_category_cards_manage on public.category_card_configs
for all to authenticated using (public.has_admin_department_access('marketing_corporate_affairs'))
with check (public.has_admin_department_access('marketing_corporate_affairs'));

-- Operations / Executive task execution
drop policy if exists department_execution_staff_tasks_manage on public.staff_tasks;
create policy department_execution_staff_tasks_manage on public.staff_tasks
for all to authenticated using (
  public.has_admin_department_access('operations')
  or public.has_admin_department_access('executive')
) with check (
  public.has_admin_department_access('operations')
  or public.has_admin_department_access('executive')
);

drop policy if exists department_operations_conversion_tasks_manage on public.conversion_automation_tasks;
create policy department_operations_conversion_tasks_manage on public.conversion_automation_tasks
for all to authenticated using (public.has_admin_department_access('operations'))
with check (public.has_admin_department_access('operations'));

comment on function public.can_manage_accommodation_reservations() is 'Accommodation reservation authority: compatible legacy roles OR Accommodation Department assignment.';
comment on function public.can_manage_growth() is 'Growth/partnership authority: compatible legacy roles OR Marketing/Corporate Affairs or Partnerships department assignment.';
comment on function public.can_manage_site_content() is 'Public content authority: compatible legacy roles OR Marketing & Corporate Affairs department assignment.';
