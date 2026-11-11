-- AdminOS monthly Top 3: transparent editorial positions without rewriting organic performance.
-- Public users see only the privacy-safe read RPC, not this admin configuration table.
create table if not exists public.reskonnect_monthly_top3_editorial (
  month_start date not null check (extract(day from month_start)=1),
  position smallint not null check (position between 1 and 3),
  residence_id uuid not null references public.residences(id) on delete cascade,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (month_start,position),
  unique (month_start,residence_id)
);
create index if not exists rk_monthly_top3_editorial_residence_idx
 on public.reskonnect_monthly_top3_editorial(residence_id);
alter table public.reskonnect_monthly_top3_editorial enable row level security;
revoke all on public.reskonnect_monthly_top3_editorial from public,anon,authenticated;
grant select,insert,update,delete on public.reskonnect_monthly_top3_editorial to authenticated;

create policy rk_top3_editorial_admin_read on public.reskonnect_monthly_top3_editorial
 for select to authenticated
 using ((select public.has_role((select auth.uid()),'admin'::public.app_role)));
create policy rk_top3_editorial_admin_insert on public.reskonnect_monthly_top3_editorial
 for insert to authenticated
 with check ((select public.has_role((select auth.uid()),'admin'::public.app_role))
  and updated_by=(select auth.uid())
  and exists (select 1 from public.residences r where r.id=residence_id and r.is_visible=true
   and (nullif(r.cover_image_url,'') is not null or nullif(r.image_url,'') is not null
    or cardinality(coalesce(r.images,array[]::text[]))>0)));
create policy rk_top3_editorial_admin_update on public.reskonnect_monthly_top3_editorial
 for update to authenticated
 using ((select public.has_role((select auth.uid()),'admin'::public.app_role)))
 with check ((select public.has_role((select auth.uid()),'admin'::public.app_role))
  and updated_by=(select auth.uid())
  and exists (select 1 from public.residences r where r.id=residence_id and r.is_visible=true
   and (nullif(r.cover_image_url,'') is not null or nullif(r.image_url,'') is not null
    or cardinality(coalesce(r.images,array[]::text[]))>0)));
create policy rk_top3_editorial_admin_delete on public.reskonnect_monthly_top3_editorial
 for delete to authenticated
 using ((select public.has_role((select auth.uid()),'admin'::public.app_role)));

-- Keep reskonnect_public_top3_monthly() untouched as the unbiased organic benchmark.
-- Manual positions take precedence for this month only; any empty positions
-- are filled from the independent organic list without duplicating a property.
create or replace function public.reskonnect_public_monthly_showcase()
returns table(residence_id uuid,rank_position bigint,applications_count bigint,
 reservations_count bigint,activity_score bigint,month_start date,selection_type text)
language sql stable security definer set search_path=public,pg_temp as $$
 with current_month as (
  select date_trunc('month',now())::date as month_start
 ), manual as (
  select e.residence_id,e.position::bigint as slot,m.month_start
  from public.reskonnect_monthly_top3_editorial e
  join current_month m on e.month_start=m.month_start
  join public.residences r on r.id=e.residence_id
  where r.is_visible=true
    and (nullif(r.cover_image_url,'') is not null or nullif(r.image_url,'') is not null
      or cardinality(coalesce(r.images,array[]::text[]))>0)
 ), organic as (
  select o.*,row_number() over(order by o.rank_position)::bigint as available_rank
  from public.reskonnect_public_top3_monthly() o
  where not exists(select 1 from manual m where m.residence_id=o.residence_id)
 ), open_slots as (
  select s.slot::bigint,row_number() over(order by s.slot)::bigint as available_rank
  from generate_series(1,3) as s(slot)
  where not exists(select 1 from manual m where m.slot=s.slot)
 ), showcase as (
  select m.residence_id,m.slot,null::bigint as applications_count,
   null::bigint as reservations_count,null::bigint as activity_score,
   m.month_start,'editorial'::text as selection_type
  from manual m
  union all
  select o.residence_id,s.slot,o.applications_count,o.reservations_count,
   o.activity_score,o.month_start,'organic'::text
  from open_slots s join organic o on o.available_rank=s.available_rank
 )
 select s.residence_id,s.slot as rank_position,s.applications_count,
  s.reservations_count,s.activity_score,s.month_start,s.selection_type
 from showcase s order by s.slot;
$$;
revoke all on function public.reskonnect_public_monthly_showcase() from public,anon,authenticated;
grant execute on function public.reskonnect_public_monthly_showcase() to anon,authenticated;
comment on function public.reskonnect_public_monthly_showcase() is
 'Monthly public showcase. Admin-selected positions are labelled editorial, otherwise fills from the independent organic student-interest ranking. No applicant identities or sponsored performance claims exposed.';
