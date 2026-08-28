alter table public.profiles add column if not exists surname text;

create table if not exists public.handover_application_exclusions (
  application_id uuid primary key references public.applications(id) on delete cascade,
  canonical_application_id uuid references public.applications(id) on delete set null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  excluded_by uuid,
  excluded_at timestamptz not null default now()
);

create table if not exists public.handover_integrity_runs (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid references public.residences(id) on delete set null,
  mode text not null,
  ok boolean not null,
  blocking_errors integer not null default 0,
  warnings integer not null default 0,
  eligible_rows integer not null default 0,
  excluded_rows integer not null default 0,
  fingerprint text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.handover_corrections (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete set null,
  user_id uuid,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

alter table public.handover_application_exclusions enable row level security;
alter table public.handover_integrity_runs enable row level security;
alter table public.handover_corrections enable row level security;

drop policy if exists "handover admins read exclusions" on public.handover_application_exclusions;
create policy "handover admins read exclusions" on public.handover_application_exclusions for select to authenticated using (public.has_role(auth.uid(),'admin'::public.app_role) or public.has_role(auth.uid(),'operations_lead'::public.app_role));
drop policy if exists "handover admins read runs" on public.handover_integrity_runs;
create policy "handover admins read runs" on public.handover_integrity_runs for select to authenticated using (public.has_role(auth.uid(),'admin'::public.app_role) or public.has_role(auth.uid(),'operations_lead'::public.app_role));
drop policy if exists "handover admins read corrections" on public.handover_corrections;
create policy "handover admins read corrections" on public.handover_corrections for select to authenticated using (public.has_role(auth.uid(),'admin'::public.app_role) or public.has_role(auth.uid(),'operations_lead'::public.app_role));

create or replace function public.can_manage_handover_export()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role() = 'service_role', false)
      or public.has_role(auth.uid(),'admin'::public.app_role)
      or public.has_role(auth.uid(),'operations_lead'::public.app_role)
$$;
revoke all on function public.can_manage_handover_export() from public;
grant execute on function public.can_manage_handover_export() to authenticated, service_role;

drop view if exists public.residence_handover_export_v cascade;
create view public.residence_handover_export_v with (security_invoker = on) as
select
  a.id as application_id,
  upper(substring(replace(a.id::text,'-','') for 8)) as ref_code,
  a.residence_id,
  r.name as residence_name,
  a.user_id,
  case
    when nullif(btrim(coalesce(p.full_name,'')),'') is null then null
    when nullif(btrim(coalesce(p.surname,'')),'') is not null then nullif(btrim(replace(p.full_name,p.surname,'')),'')
    else nullif(split_part(btrim(p.full_name),' ',1),'')
  end as student_name,
  coalesce(
    nullif(btrim(p.surname),''),
    case when p.full_name is not null and position(' ' in btrim(p.full_name)) > 0
      then nullif(btrim(substring(btrim(p.full_name) from position(' ' in btrim(p.full_name)) + 1)),'')
      else null end
  ) as student_surname,
  nullif(btrim(p.full_name),'') as full_name,
  nullif(btrim(p.student_number),'') as student_number,
  nullif(btrim(p.identity_number),'') as identity_number,
  nullif(btrim(p.applicant_stage),'') as applicant_stage,
  nullif(lower(btrim(a.funding_type)),'') as funding_source,
  nullif(lower(btrim(p.email)),'') as email,
  nullif(btrim(coalesce(p.phone,p.phone_number)),'') as phone,
  nullif(btrim(p.campus),'') as campus,
  nullif(btrim(p.course),'') as course,
  nullif(lower(btrim(a.status)),'') as status,
  a.institution_type,
  a.application_date,
  a.move_in_date,
  a.moved_in,
  a.created_at,
  a.updated_at,
  (hx.application_id is not null) as handover_excluded,
  hx.canonical_application_id,
  hx.reason as exclusion_reason
from public.applications a
left join public.profiles p on p.id=a.user_id
left join public.residences r on r.id=a.residence_id
left join public.handover_application_exclusions hx on hx.application_id=a.id;

grant select on public.residence_handover_export_v to authenticated, service_role;
