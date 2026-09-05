-- Capture acquisition source during account creation for growth attribution.
alter table public.profiles
  add column if not exists heard_about_us text,
  add column if not exists recruiter_reference text;

create index if not exists idx_profiles_heard_about_us
  on public.profiles (heard_about_us)
  where heard_about_us is not null;

comment on column public.profiles.heard_about_us is
  'Self-reported acquisition source selected during signup.';
comment on column public.profiles.recruiter_reference is
  'Optional recruiter, ambassador, or recruiter-code reference supplied during signup.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _email text := lower(coalesce(new.email, ''));
begin
  begin
    insert into public.profiles (
      id,
      full_name,
      email,
      phone,
      student_number,
      identity_number,
      campus,
      applicant_stage,
      heard_about_us,
      recruiter_reference
    ) values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name',''),
      new.email,
      nullif(new.raw_user_meta_data->>'phone',''),
      nullif(new.raw_user_meta_data->>'student_number',''),
      nullif(new.raw_user_meta_data->>'identity_number',''),
      nullif(new.raw_user_meta_data->>'campus',''),
      nullif(new.raw_user_meta_data->>'applicant_stage',''),
      nullif(new.raw_user_meta_data->>'heard_about_us',''),
      nullif(new.raw_user_meta_data->>'recruiter_reference','')
    )
    on conflict (id) do update set
      email = excluded.email,
      full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
      phone = coalesce(nullif(public.profiles.phone, ''), excluded.phone),
      student_number = coalesce(nullif(public.profiles.student_number, ''), excluded.student_number),
      identity_number = coalesce(nullif(public.profiles.identity_number, ''), excluded.identity_number),
      campus = coalesce(nullif(public.profiles.campus, ''), excluded.campus),
      applicant_stage = coalesce(public.profiles.applicant_stage, excluded.applicant_stage),
      heard_about_us = coalesce(public.profiles.heard_about_us, excluded.heard_about_us),
      recruiter_reference = coalesce(public.profiles.recruiter_reference, excluded.recruiter_reference),
      updated_at = now();
  exception when unique_violation then
    null;
  end;

  insert into public.user_roles (user_id, role)
  values (new.id, 'student'::public.app_role)
  on conflict (user_id, role) do nothing;

  if _email in ('43v3r2a11@gmail.com','reskonnect@gmail.com') then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin'::public.app_role)
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$function$;
