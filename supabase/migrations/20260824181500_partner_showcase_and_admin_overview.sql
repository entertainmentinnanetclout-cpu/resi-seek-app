-- Partner/client/institution showcase + backend-powered admin overview.

create table if not exists public.partner_showcase (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  relationship_type text not null default 'partner' check (relationship_type in ('partner','strategic_collaborator','client','institutional_ecosystem','regulatory_reference','technology_provider')),
  short_label text,
  description text,
  logo_url text not null,
  website_url text,
  compliance_note text,
  is_featured boolean not null default true,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partner_showcase enable row level security;

drop policy if exists "Public can view published partner showcase" on public.partner_showcase;
create policy "Public can view published partner showcase"
on public.partner_showcase
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Staff manage partner showcase" on public.partner_showcase;
create policy "Staff manage partner showcase"
on public.partner_showcase
for all
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('admin','super_admin','developer','owner','growth_lead')
  )
)
with check (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('admin','super_admin','developer','owner','growth_lead')
  )
);

drop trigger if exists update_partner_showcase_updated_at on public.partner_showcase;
create trigger update_partner_showcase_updated_at
before update on public.partner_showcase
for each row execute function public.update_updated_at_column();

-- Seed only an identity already represented in production backend data.
-- Relationship wording deliberately avoids implying endorsement.
insert into public.partner_showcase (
  slug, name, relationship_type, short_label, description, logo_url, website_url, compliance_note, sort_order
) values (
  'tut',
  'Tshwane University of Technology',
  'institutional_ecosystem',
  'Institutional ecosystem',
  'An institution within the student ecosystem served by ResKonnect.',
  'https://mefjzkhobkltlbmhusdh.supabase.co/storage/v1/object/public/admin-images/applications-hub/tut/logo_url-1787042761365-tut-logo.jpg',
  'https://www.tut.ac.za',
  'Logo placement indicates institutional ecosystem context only and does not by itself imply endorsement.',
  10
)
on conflict (slug) do update set
  name = excluded.name,
  relationship_type = excluded.relationship_type,
  short_label = excluded.short_label,
  description = excluded.description,
  logo_url = excluded.logo_url,
  website_url = excluded.website_url,
  compliance_note = excluded.compliance_note,
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace function public.admin_dashboard_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
  metrics jsonb;
  recent_apps jsonb;
  recent_events jsonb;
  unresolved_alerts jsonb;
begin
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('admin','super_admin','developer','owner','growth_lead')
  ) into allowed;

  if auth.uid() is null or not allowed then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'totalResidences', (select count(*) from public.residences),
    'totalApplications', (select count(*) from public.applications),
    'pendingApplications', (select count(*) from public.applications where status in ('submitted','documents_required','under_review','conditionally_approved')),
    'approvedApplications', (select count(*) from public.applications where status = 'approved'),
    'rejectedApplications', (select count(*) from public.applications where status = 'rejected'),
    'totalUsers', (select count(*) from public.profiles),
    'totalListings', (select count(*) from public.marketplace_listings),
    'unverifiedListings', (select count(*) from public.marketplace_listings where coalesce(verified,false) = false),
    'totalViews', (select count(*) from public.residence_analytics),
    'activeBursaries', (select count(*) from public.bursaries where is_active = true),
    'activeDiscounts', (select count(*) from public.student_discounts where is_active = true),
    'totalStores', (select count(*) from public.stores),
    'totalWilApps', (select count(*) from public.wil_applications),
    'pendingWilApps', (select count(*) from public.wil_applications where status in ('submitted','under_review','pending')),
    'totalPortals', (select count(*) from public.residence_portal_accounts where is_active = true),
    'totalHamperOrders', (select count(*) from public.hamper_orders),
    'totalDiscountOrders', (select count(*) from public.discount_orders),
    'totalSlides', (select count(*) from public.hero_slides where coalesce(is_active,true) = true),
    'totalNews', (select count(*) from public.campus_news where coalesce(is_published,true) = true),
    'totalEvents', (select count(*) from public.events),
    'totalSections', (select count(*) from public.residence_sections where is_active = true),
    'totalAvailableSpots', (select coalesce(sum(coalesce(available_spots,0)),0) from public.residences),
    'fullResidences', (select count(*) from public.residences where coalesce(available_spots,0) = 0),
    'unresolvedAlerts', (select count(*) from public.admin_alerts where coalesce(resolved,false) = false),
    'publishedPartners', (select count(*) from public.partner_showcase where is_published = true),
    'generatedAt', now()
  ) into metrics;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into recent_apps
  from (
    select
      a.id,
      a.status,
      a.created_at,
      a.funding_type,
      p.full_name as student_name,
      p.student_number,
      r.name as residence_name
    from public.applications a
    left join public.profiles p on p.id = a.user_id
    left join public.residences r on r.id = a.residence_id
    order by a.created_at desc
    limit 8
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into recent_events
  from (
    select id, type, entity, entity_id, metadata, payload, created_at
    from public.system_events
    order by created_at desc
    limit 10
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into unresolved_alerts
  from (
    select id, title, description, severity, created_at
    from public.admin_alerts
    where coalesce(resolved,false) = false
    order by created_at desc
    limit 8
  ) x;

  return jsonb_build_object(
    'metrics', metrics,
    'recentApplications', recent_apps,
    'recentEvents', recent_events,
    'alerts', unresolved_alerts
  );
end;
$$;

revoke all on function public.admin_dashboard_overview() from public;
grant execute on function public.admin_dashboard_overview() to authenticated;

create index if not exists idx_partner_showcase_public_order
  on public.partner_showcase (is_published, is_featured, sort_order, created_at);
