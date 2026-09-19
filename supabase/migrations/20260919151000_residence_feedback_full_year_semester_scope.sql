-- 3 denotes BOTH semesters / full academic year, not a third semester.
-- Existing first-/second-semester records are preserved without backfilling inferred dates.
alter table public.residence_stay_feedback
  drop constraint if exists residence_stay_feedback_stay_semester_check;
alter table public.residence_stay_feedback
  add constraint residence_stay_feedback_stay_semester_check check (stay_semester in (1,2,3));

alter table public.single_room_waitlist
  drop constraint if exists single_room_waitlist_semester_check;
alter table public.single_room_waitlist
  add constraint single_room_waitlist_semester_check check (semester in (1,2,3));

comment on column public.residence_stay_feedback.stay_semester is '1 = first semester only, 2 = second semester only, 3 = both semesters / full academic-year stay';
comment on column public.single_room_waitlist.semester is 'Desired search/intake period: 1 = first semester, 2 = second semester, 3 = both semesters / full academic year. A search period is not a contractual tenancy end date.';
