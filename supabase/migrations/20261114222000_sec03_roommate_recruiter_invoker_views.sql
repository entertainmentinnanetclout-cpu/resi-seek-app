-- SEC-03: Replace privileged public roommate and recruitment views with invoker/RLS-safe reads.
-- Keep existing view names, order, column types and URLs for compatibility.
-- Public roommate cards contain only opted-in display data, never the full profiles table.

create table if not exists public.rk_roommate_public_cards (
 id uuid primary key references public.profiles(id) on delete cascade,
 full_name text,
 campus text,
 course text,
 year_of_study text,
 profile_picture_url text,
 lifestyle_preferences jsonb not null default '{}'::jsonb,
 looking_for_roommate boolean not null default true check(looking_for_roommate=true),
 updated_at timestamptz not null default now()
);
alter table public.rk_roommate_public_cards enable row level security;
revoke all on table public.rk_roommate_public_cards from public,anon,authenticated;
drop policy if exists rk_roommate_cards_opt_in_read on public.rk_roommate_public_cards;
create policy rk_roommate_cards_opt_in_read
 on public.rk_roommate_public_cards for select to anon,authenticated
 using (looking_for_roommate is true);
grant select on table public.rk_roommate_public_cards to anon,authenticated;

create or replace function reskonnect_internal.rk_sync_opted_in_roommate_card()
returns trigger language plpgsql security definer set search_path='' as $body$
declare v_preferences jsonb;
begin
 if TG_OP='DELETE' then
  delete from public.rk_roommate_public_cards where id=old.id;
  return old;
 end if;
 if coalesce(new.looking_for_roommate,false) is not true then
  delete from public.rk_roommate_public_cards where id=new.id;
  return new;
 end if;
 -- Only explicitly supported lifestyle keys; unrelated JSON fields never become public.
 select coalesce(jsonb_object_agg(k.key,left(k.value,60)),'{}'::jsonb)
 into v_preferences
 from jsonb_each_text(
    case when jsonb_typeof(new.lifestyle_preferences)='object'
    then new.lifestyle_preferences else '{}'::jsonb end
 ) as k(key,value)
 where k.key in ('sleepSchedule','studyHabits','cleanliness','socialLevel','smoking')
   and length(k.value)<=60;
 insert into public.rk_roommate_public_cards
  (id,full_name,campus,course,year_of_study,profile_picture_url,
   lifestyle_preferences,looking_for_roommate,updated_at)
 values(new.id,left(nullif(btrim(new.full_name),''),120),
  left(new.campus,150),left(new.course,150),left(new.year_of_study,60),
  left(new.profile_picture_url,1200),v_preferences,true,coalesce(new.updated_at,now()))
 on conflict(id) do update set
 full_name=excluded.full_name,
 campus=excluded.campus,
 course=excluded.course,
 year_of_study=excluded.year_of_study,
 profile_picture_url=excluded.profile_picture_url,
 lifestyle_preferences=excluded.lifestyle_preferences,
 looking_for_roommate=true,
 updated_at=excluded.updated_at;
 return new;
end
$body$;
revoke all on function reskonnect_internal.rk_sync_opted_in_roommate_card()
 from public,anon,authenticated;
drop trigger if exists rk_sync_opted_in_roommate_card on public.profiles;
create trigger rk_sync_opted_in_roommate_card
 after insert or update or delete on public.profiles
 for each row execute function reskonnect_internal.rk_sync_opted_in_roommate_card();

-- The legacy view includes nine columns; preserve them to avoid breaking the Finder.
insert into public.rk_roommate_public_cards
 (id,full_name,campus,course,year_of_study,profile_picture_url,
  lifestyle_preferences,looking_for_roommate,updated_at)
select p.id,left(nullif(btrim(p.full_name),''),120),
 left(p.campus,150),left(p.course,150),left(p.year_of_study,60),
 left(p.profile_picture_url,1200),
 (select coalesce(jsonb_object_agg(k.key,left(k.value,60)),'{}'::jsonb)
  from jsonb_each_text(
   case when jsonb_typeof(p.lifestyle_preferences)='object'
   then p.lifestyle_preferences else '{}'::jsonb end
  ) as k(key,value)
  where k.key in ('sleepSchedule','studyHabits','cleanliness','socialLevel','smoking')
   and length(k.value)<=60),
 true,coalesce(p.updated_at,now())
from public.profiles p where p.looking_for_roommate=true
on conflict(id) do update set
 full_name=excluded.full_name, campus=excluded.campus,course=excluded.course,
 year_of_study=excluded.year_of_study,profile_picture_url=excluded.profile_picture_url,
 lifestyle_preferences=excluded.lifestyle_preferences,looking_for_roommate=true,
 updated_at=excluded.updated_at;
delete from public.rk_roommate_public_cards c where not exists
 (select 1 from public.profiles p where p.id=c.id and p.looking_for_roommate=true);

create or replace view public.roommate_profiles_public_v
 with (security_barrier=true,security_invoker=true) as
 select id,full_name,campus,course,year_of_study,profile_picture_url,
  lifestyle_preferences,looking_for_roommate,updated_at
 from public.rk_roommate_public_cards
 where looking_for_roommate=true;
revoke all on public.roommate_profiles_public_v from public,anon,authenticated;
grant select on public.roommate_profiles_public_v to anon,authenticated;

-- Recruiters may see the published recruitment commission offer, but a random
-- authenticated student must not bypass recruitment programme RLS via a view.
drop policy if exists rk_approved_recruiter_read_enabled_programmes
 on public.residence_recruitment_programs;
create policy rk_approved_recruiter_read_enabled_programmes
 on public.residence_recruitment_programs
 for select to authenticated
 using(
  enabled is true and (
   public.has_role(auth.uid(),'referral_agent'::public.app_role)
   or exists(
    select 1 from public.recruiter_applications ra
    where ra.user_id=auth.uid() and ra.status='approved'
   )
  )
 );
alter view public.recruitable_residences_v set(security_invoker=true);
-- The existing view already has a security_barrier and only authenticates to signed-in users.
revoke all on public.recruitable_residences_v from public,anon;
grant select on public.recruitable_residences_v to authenticated;

notify pgrst,'reload schema';
