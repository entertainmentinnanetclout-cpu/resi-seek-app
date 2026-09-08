create or replace function public.guard_tumelo_partner_non_student()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.partnership_memberships pm
    join public.partnerships p on p.id = pm.partnership_id
    where pm.user_id = new.id
      and pm.is_active = true
      and p.slug = 'tumelo-career-education'
  ) then
    new.student_number := null;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_tumelo_partner_non_student() from public, anon, authenticated;

drop trigger if exists trg_guard_tumelo_partner_non_student on public.profiles;
create trigger trg_guard_tumelo_partner_non_student
before insert or update of student_number on public.profiles
for each row execute function public.guard_tumelo_partner_non_student();

update public.profiles p
set student_number = null,
    updated_at = now()
where exists (
  select 1
  from public.partnership_memberships pm
  join public.partnerships partner on partner.id = pm.partnership_id
  where pm.user_id = p.id
    and pm.is_active = true
    and partner.slug = 'tumelo-career-education'
);
