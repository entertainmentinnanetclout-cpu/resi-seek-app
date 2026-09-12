-- RG6 profile-context inheritance.
-- If WhatsApp does not restate academic context, inherit the verified profile
-- snapshot so Dimpho can qualify accurately without re-asking known facts.

create or replace function public.adminos_rg6_profile_context_trigger()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare p public.profiles%rowtype;
begin
  if new.user_id is not null then
    select * into p from public.profiles where id=new.user_id;
    new.campus:=coalesce(nullif(trim(new.campus),''),nullif(trim(p.campus),''));
    new.academic_year:=coalesce(new.academic_year,p.academic_year);
    if new.academic_cycle is null or new.academic_cycle='unspecified' then
      new.academic_cycle:=nullif(p.academic_cycle,'unspecified');
    end if;
    if new.academic_period is null or new.academic_period=0 then
      new.academic_period:=nullif(p.academic_period,0);
    end if;
    if new.study_level is null or new.study_level='unspecified' then
      new.study_level:=nullif(p.study_level,'unspecified');
    end if;
    if new.student_stage is null or new.student_stage='unspecified' then
      new.student_stage:=nullif(p.student_stage,'unspecified');
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.adminos_rg6_profile_context_trigger() from public,anon,authenticated;

drop trigger if exists trg_adminos_rg6_00_profile_context on public.adminos_whatsapp_conversion_leads;
create trigger trg_adminos_rg6_00_profile_context
before insert or update on public.adminos_whatsapp_conversion_leads
for each row execute function public.adminos_rg6_profile_context_trigger();

update public.adminos_whatsapp_conversion_leads set updated_at=updated_at;
