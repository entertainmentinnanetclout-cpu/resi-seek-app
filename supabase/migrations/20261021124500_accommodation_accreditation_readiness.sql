-- ResKonnect accommodation accreditation-readiness operating model
-- Sources: controlled ResKonnect compliance pack + supplied NSFAS/DHET provider requirements.
-- Important: ResKonnect readiness is never an official accreditation or grading decision.

create extension if not exists pgcrypto;

create table if not exists public.accommodation_compliance_requirements (
  code text primary key,
  sequence integer not null,
  title text not null,
  public_summary text not null,
  core_progress_gate boolean not null default false,
  authority_source text not null default 'NSFAS Required Documents Specification',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.accommodation_compliance_requirements(code,sequence,title,public_summary,core_progress_gate)
values
  ('zoning',1,'Zoning / consent-use evidence','Municipal zoning certificate or acceptable consent-use evidence for the property.',true),
  ('ownership',2,'Proof of ownership','Current ownership evidence and any applicable finance/bank authority supporting use of the property.',true),
  ('building_plans',3,'Approved building plans','Approved municipal building plans corresponding with the accommodation offered.',true),
  ('occupancy',4,'Occupancy certificate','Applicable occupancy evidence for the building and its approved use.',true),
  ('fire_coc',5,'Fire compliance certificate','Current fire-compliance evidence for the property.',true),
  ('electrical_coc',6,'Electrical Certificate of Compliance','Valid electrical compliance evidence for the property.',true),
  ('bank_confirmation',7,'Bank confirmation / corporate linkage','Bank confirmation and applicable company-linkage evidence for the nominated account.',true),
  ('security_plan',8,'Security Management Plan','Documented site security, access, visitor-control and incident-response arrangements.',false),
  ('pest_control',9,'Pest Control Certificate','Evidence of current pest-control services.',false),
  ('waste_plan',10,'Waste Management Plan','Documented waste storage, collection and cleanliness arrangements.',false),
  ('psira',11,'PSIRA evidence','Applicable PSIRA evidence for site security personnel or contracted security/armed response.',false),
  ('health_safety',12,'Health, Safety & Emergency Readiness Plan','Documented emergency, evacuation, first-aid and safety-readiness arrangements.',false),
  ('cleaning',13,'Cleaning contracts & registers','Cleaning arrangements and operating registers showing ongoing execution.',false)
on conflict (code) do update set
  sequence=excluded.sequence,
  title=excluded.title,
  public_summary=excluded.public_summary,
  core_progress_gate=excluded.core_progress_gate,
  updated_at=now();

create table if not exists public.accommodation_compliance_cases (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null unique references public.residences(id) on delete cascade,
  readiness_status text not null default 'not_yet_prepared' check (readiness_status in (
    'not_yet_prepared','preparation_in_progress','ready_for_preinspection','remediation_required','ready_for_submission_support'
  )),
  external_status text not null default 'not_submitted' check (external_status in (
    'not_submitted','submitted','document_review','inspection_pending','directive_or_remediation','evaluation','approved','declined','graded','accredited_active','suspended','revoked','expired'
  )),
  accreditation_authority text,
  submission_reference text,
  submission_date date,
  inspection_reference text,
  inspection_date date,
  official_determination text,
  official_accreditation_reference text,
  accreditation_valid_from date,
  accreditation_valid_until date,
  official_grade text,
  grade_valid_from date,
  grade_valid_until date,
  official_conditions text,
  official_evidence_path text,
  official_verified_at timestamptz,
  official_verified_by uuid references auth.users(id) on delete set null,
  internal_owner uuid references auth.users(id) on delete set null,
  last_reviewed_at timestamptz,
  next_review_at date,
  created_from_request uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accommodation_compliance_requests (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete cascade,
  requested_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  request_type text not null default 'initial_review' check (request_type in (
    'initial_review','document_review','preinspection','remediation_review','submission_support','appeal_support','renewal_review'
  )),
  status text not null default 'new' check (status in ('new','in_review','waiting_provider','scheduled','completed','cancelled')),
  provider_note text,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accommodation_compliance_cases
  drop constraint if exists accommodation_compliance_cases_created_from_request_fkey;
alter table public.accommodation_compliance_cases
  add constraint accommodation_compliance_cases_created_from_request_fkey
  foreign key (created_from_request) references public.accommodation_compliance_requests(id) on delete set null;

create table if not exists public.accommodation_compliance_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.accommodation_compliance_cases(id) on delete cascade,
  requirement_code text not null references public.accommodation_compliance_requirements(code),
  status text not null default 'uploaded_unreviewed' check (status in (
    'missing','uploaded_unreviewed','validated','needs_correction','expiring','expired','not_applicable'
  )),
  storage_path text,
  original_name text,
  issuer text,
  document_reference text,
  issue_date date,
  expiry_date date,
  provider_note text,
  reviewer_note text,
  uploaded_by uuid default auth.uid() references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists accommodation_compliance_evidence_case_requirement_idx
  on public.accommodation_compliance_evidence(case_id, requirement_code);
create index if not exists accommodation_compliance_requests_residence_status_idx
  on public.accommodation_compliance_requests(residence_id,status,created_at desc);
create index if not exists accommodation_compliance_cases_external_idx
  on public.accommodation_compliance_cases(external_status,accreditation_valid_until);

create or replace function public.compliance_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_compliance_requirements_touch on public.accommodation_compliance_requirements;
create trigger trg_compliance_requirements_touch before update on public.accommodation_compliance_requirements
for each row execute function public.compliance_touch_updated_at();

drop trigger if exists trg_compliance_cases_touch on public.accommodation_compliance_cases;
create trigger trg_compliance_cases_touch before update on public.accommodation_compliance_cases
for each row execute function public.compliance_touch_updated_at();

drop trigger if exists trg_compliance_requests_touch on public.accommodation_compliance_requests;
create trigger trg_compliance_requests_touch before update on public.accommodation_compliance_requests
for each row execute function public.compliance_touch_updated_at();

drop trigger if exists trg_compliance_evidence_touch on public.accommodation_compliance_evidence;
create trigger trg_compliance_evidence_touch before update on public.accommodation_compliance_evidence
for each row execute function public.compliance_touch_updated_at();

create or replace function public.ensure_compliance_case_from_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accommodation_compliance_cases(residence_id,created_from_request)
  values(new.residence_id,new.id)
  on conflict (residence_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_ensure_compliance_case_from_request on public.accommodation_compliance_requests;
create trigger trg_ensure_compliance_case_from_request
after insert on public.accommodation_compliance_requests
for each row execute function public.ensure_compliance_case_from_request();

create or replace function public.protect_provider_evidence_review_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(),'admin') then
    new.status := 'uploaded_unreviewed';
    new.reviewer_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_provider_evidence_review_fields on public.accommodation_compliance_evidence;
create trigger trg_protect_provider_evidence_review_fields
before insert on public.accommodation_compliance_evidence
for each row execute function public.protect_provider_evidence_review_fields();

alter table public.accommodation_compliance_requirements enable row level security;
alter table public.accommodation_compliance_cases enable row level security;
alter table public.accommodation_compliance_requests enable row level security;
alter table public.accommodation_compliance_evidence enable row level security;

-- Requirement catalog is public guidance only; internal scoring logic is not stored here.
drop policy if exists compliance_requirements_public_read on public.accommodation_compliance_requirements;
create policy compliance_requirements_public_read
on public.accommodation_compliance_requirements for select
to anon, authenticated
using (active = true);

drop policy if exists compliance_requirements_admin_write on public.accommodation_compliance_requirements;
create policy compliance_requirements_admin_write
on public.accommodation_compliance_requirements for all
to authenticated
using (public.has_role(auth.uid(),'admin'))
with check (public.has_role(auth.uid(),'admin'));

-- Cases: provider can see its own case; only ResKonnect admin can change official/readiness determinations.
drop policy if exists compliance_cases_admin_all on public.accommodation_compliance_cases;
create policy compliance_cases_admin_all
on public.accommodation_compliance_cases for all
to authenticated
using (public.has_role(auth.uid(),'admin'))
with check (public.has_role(auth.uid(),'admin'));

drop policy if exists compliance_cases_provider_read on public.accommodation_compliance_cases;
create policy compliance_cases_provider_read
on public.accommodation_compliance_cases for select
to authenticated
using (exists (
  select 1 from public.residence_portal_accounts rpa
  where rpa.residence_id = accommodation_compliance_cases.residence_id
    and rpa.user_id = auth.uid() and rpa.is_active = true
));

-- Requests: provider can request work for only its assigned residence; staff retain full control.
drop policy if exists compliance_requests_admin_all on public.accommodation_compliance_requests;
create policy compliance_requests_admin_all
on public.accommodation_compliance_requests for all
to authenticated
using (public.has_role(auth.uid(),'admin'))
with check (public.has_role(auth.uid(),'admin'));

drop policy if exists compliance_requests_provider_read on public.accommodation_compliance_requests;
create policy compliance_requests_provider_read
on public.accommodation_compliance_requests for select
to authenticated
using (exists (
  select 1 from public.residence_portal_accounts rpa
  where rpa.residence_id = accommodation_compliance_requests.residence_id
    and rpa.user_id = auth.uid() and rpa.is_active = true
));

drop policy if exists compliance_requests_provider_insert on public.accommodation_compliance_requests;
create policy compliance_requests_provider_insert
on public.accommodation_compliance_requests for insert
to authenticated
with check (
  requested_by = auth.uid()
  and status = 'new'
  and exists (
    select 1 from public.residence_portal_accounts rpa
    where rpa.residence_id = accommodation_compliance_requests.residence_id
      and rpa.user_id = auth.uid() and rpa.is_active = true
  )
);

-- Evidence: provider can upload and read its own evidence; validation state remains staff-controlled.
drop policy if exists compliance_evidence_admin_all on public.accommodation_compliance_evidence;
create policy compliance_evidence_admin_all
on public.accommodation_compliance_evidence for all
to authenticated
using (public.has_role(auth.uid(),'admin'))
with check (public.has_role(auth.uid(),'admin'));

drop policy if exists compliance_evidence_provider_read on public.accommodation_compliance_evidence;
create policy compliance_evidence_provider_read
on public.accommodation_compliance_evidence for select
to authenticated
using (exists (
  select 1
  from public.accommodation_compliance_cases c
  join public.residence_portal_accounts rpa on rpa.residence_id = c.residence_id
  where c.id = accommodation_compliance_evidence.case_id
    and rpa.user_id = auth.uid() and rpa.is_active = true
));

drop policy if exists compliance_evidence_provider_insert on public.accommodation_compliance_evidence;
create policy compliance_evidence_provider_insert
on public.accommodation_compliance_evidence for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.accommodation_compliance_cases c
    join public.residence_portal_accounts rpa on rpa.residence_id = c.residence_id
    where c.id = accommodation_compliance_evidence.case_id
      and rpa.user_id = auth.uid() and rpa.is_active = true
  )
);

grant select on public.accommodation_compliance_requirements to anon, authenticated;
grant select,insert,update,delete on public.accommodation_compliance_cases to authenticated;
grant select,insert,update,delete on public.accommodation_compliance_requests to authenticated;
grant select,insert,update,delete on public.accommodation_compliance_evidence to authenticated;

-- Private evidence bucket. Object path convention: <residence_id>/<case_id>/<filename>.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'property-compliance-evidence',
  'property-compliance-evidence',
  false,
  15728640,
  array['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists property_compliance_evidence_admin_all on storage.objects;
create policy property_compliance_evidence_admin_all
on storage.objects for all
to authenticated
using (bucket_id='property-compliance-evidence' and public.has_role(auth.uid(),'admin'))
with check (bucket_id='property-compliance-evidence' and public.has_role(auth.uid(),'admin'));

drop policy if exists property_compliance_evidence_provider_read on storage.objects;
create policy property_compliance_evidence_provider_read
on storage.objects for select
to authenticated
using (
  bucket_id='property-compliance-evidence'
  and exists (
    select 1 from public.residence_portal_accounts rpa
    where rpa.user_id=auth.uid() and rpa.is_active=true
      and rpa.residence_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists property_compliance_evidence_provider_insert on storage.objects;
create policy property_compliance_evidence_provider_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id='property-compliance-evidence'
  and exists (
    select 1 from public.residence_portal_accounts rpa
    where rpa.user_id=auth.uid() and rpa.is_active=true
      and rpa.residence_id::text = (storage.foldername(name))[1]
  )
);

-- Public-safe status RPC. It intentionally exposes no internal notes, scoring or evidence paths.
create or replace function public.get_public_accreditation_residences(p_residence_id uuid default null)
returns table (
  residence_id uuid,
  name text,
  slug text,
  address text,
  city text,
  province text,
  campus text,
  image_url text,
  accepts_nsfas boolean,
  accreditation_verified boolean,
  accreditation_status text,
  accreditation_authority text,
  accreditation_reference text,
  accreditation_valid_until date,
  official_grade text,
  grade_valid_until date,
  verified_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.name,
    r.slug,
    r.address,
    r.city,
    r.province,
    r.campus,
    coalesce(r.cover_image_url,r.image_url,case when coalesce(array_length(r.images,1),0)>0 then r.images[1] else null end),
    coalesce(r.accepts_nsfas,false),
    (c.official_verified_at is not null
      and c.external_status='accredited_active'
      and c.accreditation_valid_until is not null
      and c.accreditation_valid_until >= current_date) as accreditation_verified,
    case when c.official_verified_at is not null then c.external_status else 'unknown' end,
    case when c.official_verified_at is not null then c.accreditation_authority else null end,
    case when c.official_verified_at is not null then c.official_accreditation_reference else null end,
    case when c.official_verified_at is not null then c.accreditation_valid_until else null end,
    case when c.official_verified_at is not null then c.official_grade else null end,
    case when c.official_verified_at is not null then c.grade_valid_until else null end,
    c.official_verified_at
  from public.residences r
  left join public.accommodation_compliance_cases c on c.residence_id=r.id
  where coalesce(r.is_visible,true)=true
    and (p_residence_id is null or r.id=p_residence_id)
  order by r.featured_rank desc nulls last, r.name;
$$;

revoke all on function public.get_public_accreditation_residences(uuid) from public;
grant execute on function public.get_public_accreditation_residences(uuid) to anon, authenticated;

comment on function public.get_public_accreditation_residences(uuid) is
'Public-safe ResKonnect accommodation status. accepts_nsfas means funding acceptance only; accreditation_verified requires staff-verified official evidence, active status and a current validity date.';
