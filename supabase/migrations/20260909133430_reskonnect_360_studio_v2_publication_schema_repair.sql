-- Align the legacy virtual_tour_publications table with the V2 immutable publication contract.
-- Safe for existing installations; legacy columns are retained for compatibility.

alter table public.virtual_tour_publications
  add column if not exists residence_id uuid references public.residences(id) on delete cascade,
  add column if not exists version_number integer,
  add column if not exists public_token uuid default gen_random_uuid(),
  add column if not exists snapshot jsonb not null default '{}'::jsonb,
  add column if not exists valid_until timestamptz;

update public.virtual_tour_publications p
set residence_id=t.residence_id
from public.virtual_tours t
where p.tour_id=t.id and p.residence_id is null;

update public.virtual_tour_publications
set version_number=coalesce(version_number,version_no,1)
where version_number is null;

update public.virtual_tour_publications p
set public_token=coalesce(p.public_token,t.public_token,gen_random_uuid())
from public.virtual_tours t
where p.tour_id=t.id and p.public_token is null;

create unique index if not exists virtual_tour_publications_public_token_idx
  on public.virtual_tour_publications(public_token)
  where public_token is not null;

create index if not exists virtual_tour_publications_residence_idx
  on public.virtual_tour_publications(residence_id,published_at desc);
