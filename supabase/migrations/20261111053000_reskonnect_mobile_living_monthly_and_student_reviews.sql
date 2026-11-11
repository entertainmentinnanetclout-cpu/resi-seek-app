-- Mobile Living marketplace: measured monthly interest, verified student feedback.
-- No paid promotion can influence organic monthly ranking or user review averages.
-- This migration does not backfill or endorse existing unverified legacy reviews.

create table if not exists public.reskonnect_student_residence_reviews (
 id uuid primary key default gen_random_uuid(),
 residence_id uuid not null references public.residences(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 rating smallint not null check (rating between 1 and 5),
 title text not null check (char_length(btrim(title)) between 3 and 100),
 comment text check (comment is null or char_length(comment) <= 1200),
 comment_public boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(residence_id,user_id)
);
create index if not exists reskonnect_student_residence_reviews_residence_idx
 on public.reskonnect_student_residence_reviews(residence_id,created_at desc);

alter table public.reskonnect_student_residence_reviews enable row level security;
revoke all on public.reskonnect_student_residence_reviews from public,anon,authenticated;
grant select,insert,update,delete on public.reskonnect_student_residence_reviews to authenticated;

create or replace function public.reskonnect_can_student_rate_residence(p_residence_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and exists(
  select 1 from public.applications a join public.residences r on r.id=a.residence_id
  where a.user_id=auth.uid() and a.residence_id=p_residence_id
  and a.status='approved' and coalesce(r.is_visible,false)=true
 );
$$;
revoke all on function public.reskonnect_can_student_rate_residence(uuid) from public,anon;
grant execute on function public.reskonnect_can_student_rate_residence(uuid) to authenticated;

drop policy if exists rk_student_reviews_select_own on public.reskonnect_student_residence_reviews;
create policy rk_student_reviews_select_own on public.reskonnect_student_residence_reviews
 for select to authenticated using(user_id=(select auth.uid()) or public.has_role((select auth.uid()),'admin'::public.app_role));
drop policy if exists rk_student_reviews_insert_eligible on public.reskonnect_student_residence_reviews;
create policy rk_student_reviews_insert_eligible on public.reskonnect_student_residence_reviews
 for insert to authenticated with check(user_id=(select auth.uid()) and public.reskonnect_can_student_rate_residence(residence_id));
drop policy if exists rk_student_reviews_update_eligible on public.reskonnect_student_residence_reviews;
create policy rk_student_reviews_update_eligible on public.reskonnect_student_residence_reviews
 for update to authenticated
 using(user_id=(select auth.uid()) and public.reskonnect_can_student_rate_residence(residence_id)
       or public.has_role((select auth.uid()),'admin'::public.app_role))
 with check(user_id=(select auth.uid()) and public.reskonnect_can_student_rate_residence(residence_id)
       or public.has_role((select auth.uid()),'admin'::public.app_role));
drop policy if exists rk_student_reviews_delete_own on public.reskonnect_student_residence_reviews;
create policy rk_student_reviews_delete_own on public.reskonnect_student_residence_reviews
 for delete to authenticated using(user_id=(select auth.uid()));
-- Admin staff can see all review feedback for moderation; students see only their own.
-- Public visitors only receive aggregates and explicitly approved text via safe RPCs.

create or replace function public.reskonnect_protect_student_review_fields()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and new.user_id<>old.user_id then
  raise exception 'review author cannot be changed' using errcode='42501';
 end if;
 if tg_op='UPDATE' and new.residence_id<>old.residence_id then
  raise exception 'review residence cannot be changed' using errcode='42501';
 end if;
 if not public.has_role((select auth.uid()),'admin'::public.app_role) then
  new.comment_public:=false;
 end if;
 new.updated_at:=now();
 return new;
end;$$;
revoke all on function public.reskonnect_protect_student_review_fields() from public,anon,authenticated;
drop trigger if exists rk_student_review_guard on public.reskonnect_student_residence_reviews;
create trigger rk_student_review_guard before insert or update on public.reskonnect_student_residence_reviews
for each row execute function public.reskonnect_protect_student_review_fields();

create or replace function public.reskonnect_public_residence_review_scores()
returns table(residence_id uuid,rating_average numeric,rating_count bigint)
language sql stable security definer set search_path=public,pg_temp as $$
 select r.residence_id,round(avg(r.rating)::numeric,1) as rating_average,
 count(distinct r.user_id)::bigint rating_count
 from public.reskonnect_student_residence_reviews r
 join public.residences res on res.id=r.residence_id and res.is_visible=true
 group by r.residence_id
 having count(distinct r.user_id)>0;
$$;
revoke all on function public.reskonnect_public_residence_review_scores() from public;
grant execute on function public.reskonnect_public_residence_review_scores() to anon,authenticated;

create or replace function public.reskonnect_public_residence_review_excerpts(p_residence_id uuid)
returns table(rating smallint,title text,comment text,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select rv.rating,case when rv.comment_public then rv.title else 'Student rating' end,
 case when rv.comment_public then rv.comment else null end,
 rv.created_at
 from public.reskonnect_student_residence_reviews rv
 join public.residences r on r.id=rv.residence_id and r.is_visible=true
 where rv.residence_id=p_residence_id
 order by rv.created_at desc limit 30;
$$;
revoke all on function public.reskonnect_public_residence_review_excerpts(uuid) from public;
grant execute on function public.reskonnect_public_residence_review_excerpts(uuid) to anon,authenticated;

-- Organic performance: distinct applicant / reservation accounts during one
-- calendar month. Ignore rejected/withdrawn records and do not use page views,
-- reviews or sponsorship. No student IDs leave this function.
create or replace function public.reskonnect_public_top3_monthly()
returns table(residence_id uuid,rank_position bigint,applications_count bigint,reservations_count bigint,activity_score bigint,month_start date)
language sql stable security definer set search_path=public,pg_temp as $$
 with month_bounds as (
  select date_trunc('month',now()) as start_time,
         date_trunc('month',now())+interval '1 month' as end_time
 ),
 apps as (
  select a.residence_id,count(distinct a.user_id)::bigint as n
  from public.applications a cross join month_bounds mb
  where a.created_at>=mb.start_time and a.created_at<mb.end_time
    and a.status not in ('rejected','withdrawn')
  group by a.residence_id
 ),
 bookings as (
  select b.residence_id,count(distinct b.user_id)::bigint as n
  from public.accommodation_reservations b cross join month_bounds mb
  where b.created_at>=mb.start_time and b.created_at<mb.end_time
    and b.status not in ('cancelled')
  group by b.residence_id
 ),
 scored as (
  select r.id as residence_id,coalesce(a.n,0)::bigint as apps,
    coalesce(b.n,0)::bigint as booked,
    (coalesce(a.n,0)+2*coalesce(b.n,0))::bigint as score
  from public.residences r
  left join apps a on a.residence_id=r.id
  left join bookings b on b.residence_id=r.id
  where r.is_visible=true
    and (nullif(r.cover_image_url,'') is not null or nullif(r.image_url,'') is not null
      or cardinality(coalesce(r.images,array[]::text[]))>0)
 )
 select s.residence_id,
 row_number() over(order by s.score desc,s.booked desc,s.apps desc,s.residence_id)::bigint,
 s.apps,s.booked,s.score,date_trunc('month',now())::date
 from scored s where s.score>0
 order by s.score desc,s.booked desc,s.apps desc,s.residence_id
 limit 3;
$$;
revoke all on function public.reskonnect_public_top3_monthly() from public;
grant execute on function public.reskonnect_public_top3_monthly() to anon,authenticated;

comment on function public.reskonnect_public_top3_monthly()
is 'Public monthly organic accommodation interest. Two points per unique reservation-intent account and one per unique applicant account. No sponsored/editorial weights or personal details.';
comment on function public.reskonnect_public_residence_review_scores()
is 'Average of one real approved applicant vote per residence; no rating or average is returned before the first eligible student review.';
