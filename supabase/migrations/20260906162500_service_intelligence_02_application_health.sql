-- Phase 2/10: Application Health Score
-- Rule-based and deterministic. No AI calls.

create table if not exists public.adminos_application_health_scores (
  application_id uuid primary key references public.applications(id) on delete cascade,
  user_id uuid,
  contact_id uuid references public.adminos_contacts(id) on delete set null,
  score integer not null default 0 check (score between 0 and 100),
  health_band text not null default 'incomplete' check (health_band in ('ready','attention','incomplete','blocked')),
  missing_items jsonb not null default '[]'::jsonb,
  components jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now()
);
create index if not exists idx_adminos_application_health_user on public.adminos_application_health_scores(user_id, calculated_at desc);
create index if not exists idx_adminos_application_health_score on public.adminos_application_health_scores(score, calculated_at desc);
alter table public.adminos_application_health_scores enable row level security;
drop policy if exists "Application health visible to owner and staff" on public.adminos_application_health_scores;
create policy "Application health visible to owner and staff" on public.adminos_application_health_scores
for select to authenticated using (user_id = auth.uid() or (select public.adminos_is_staff()));
revoke all on public.adminos_application_health_scores from anon;
grant select on public.adminos_application_health_scores to authenticated;

create or replace function public.adminos_recalculate_application_health(p_application_id uuid)
returns public.adminos_application_health_scores
language plpgsql security definer set search_path=public as $$
declare
  a public.applications%rowtype;
  p public.profiles%rowtype;
  s integer := 0;
  profile_score integer := 0;
  application_score integer := 0;
  document_score integer := 0;
  missing jsonb := '[]'::jsonb;
  docs text[] := '{}';
  blocked boolean := false;
  result public.adminos_application_health_scores%rowtype;
begin
  select * into a from public.applications where id=p_application_id;
  if a.id is null then return null; end if;
  select * into p from public.profiles where id=a.user_id;
  select coalesce(array_agg(lower(regexp_replace(coalesce(doc_type,''),'[^a-z0-9]+','','g'))),'{}'::text[]) into docs
  from public.application_documents where application_id=a.id and lower(coalesce(status,'')) not in ('rejected','invalid','missing','needs_action');

  if nullif(trim(coalesce(p.full_name,'')),'') is not null then profile_score:=profile_score+5; else missing:=missing||jsonb_build_array(jsonb_build_object('key','full_name','label','Add full name','area','profile','url','https://www.reskonnect.org/profile')); end if;
  if nullif(trim(coalesce(p.email,'')),'') is not null then profile_score:=profile_score+5; else missing:=missing||jsonb_build_array(jsonb_build_object('key','email','label','Add email address','area','profile','url','https://www.reskonnect.org/profile')); end if;
  if nullif(trim(coalesce(p.phone,p.phone_number,'')),'') is not null then profile_score:=profile_score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','phone','label','Add WhatsApp/contact number','area','profile','url','https://www.reskonnect.org/profile')); end if;
  if nullif(trim(coalesce(p.campus,'')),'') is not null then profile_score:=profile_score+5; else missing:=missing||jsonb_build_array(jsonb_build_object('key','campus','label','Confirm campus','area','profile','url','https://www.reskonnect.org/profile')); end if;
  if nullif(trim(coalesce(p.student_number,'')),'') is not null then profile_score:=profile_score+5; else missing:=missing||jsonb_build_array(jsonb_build_object('key','student_number','label','Add student number','area','profile','url','https://www.reskonnect.org/profile')); end if;

  if a.residence_id is not null then application_score:=application_score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','residence','label','Choose accommodation','area','application','url','https://www.reskonnect.org/findmyres')); end if;
  if nullif(trim(coalesce(a.funding_type,'')),'') is not null and lower(a.funding_type) not in ('unknown','undecided','unsure') then application_score:=application_score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','funding','label','Confirm funding type','area','application','url','https://www.reskonnect.org/my-applications')); end if;
  if a.move_in_date is not null then application_score:=application_score+5; else missing:=missing||jsonb_build_array(jsonb_build_object('key','move_in_date','label','Confirm intended move-in date','area','application','url','https://www.reskonnect.org/my-applications')); end if;
  if nullif(trim(coalesce(a.institution_type,'')),'') is not null then application_score:=application_score+5; else missing:=missing||jsonb_build_array(jsonb_build_object('key','institution_type','label','Confirm institution type','area','application','url','https://www.reskonnect.org/my-applications')); end if;
  if lower(coalesce(a.status,'')) not in ('rejected','cancelled','declined') then application_score:=application_score+5; else blocked:=true; missing:=missing||jsonb_build_array(jsonb_build_object('key','status','label','Application needs staff review','area','application','url','https://www.reskonnect.org/my-applications')); end if;

  if exists(select 1 from unnest(docs) d where d ~ '(id|identity|passport)') then document_score:=document_score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','identity_document','label','Upload identity document','area','documents','url','https://www.reskonnect.org/my-applications')); end if;
  if exists(select 1 from unnest(docs) d where d ~ '(registration|proofofregistration|enrolment|enrollment)') then document_score:=document_score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','registration_document','label','Upload proof of registration','area','documents','url','https://www.reskonnect.org/my-applications')); end if;
  if exists(select 1 from unnest(docs) d where d ~ '(funding|nsfas|bursary|sponsor)') then document_score:=document_score+10; else missing:=missing||jsonb_build_array(jsonb_build_object('key','funding_document','label','Upload proof of funding','area','documents','url','https://www.reskonnect.org/my-applications')); end if;
  if exists(select 1 from unnest(docs) d where d ~ '(studentcard|studentid)') then document_score:=document_score+5; else missing:=missing||jsonb_build_array(jsonb_build_object('key','student_card','label','Upload student card','area','documents','url','https://www.reskonnect.org/my-applications')); end if;

  s := least(100,profile_score+application_score+document_score);
  insert into public.adminos_application_health_scores(application_id,user_id,contact_id,score,health_band,missing_items,components,calculated_at)
  values(a.id,a.user_id,public.adminos_contact_id_for_user(a.user_id),s,
    case when blocked then 'blocked' when s>=85 then 'ready' when s>=60 then 'attention' else 'incomplete' end,
    missing,
    jsonb_build_object('profile',jsonb_build_object('score',profile_score,'max',30),'application',jsonb_build_object('score',application_score,'max',35),'documents',jsonb_build_object('score',document_score,'max',35)),
    now())
  on conflict (application_id) do update set user_id=excluded.user_id,contact_id=excluded.contact_id,score=excluded.score,health_band=excluded.health_band,missing_items=excluded.missing_items,components=excluded.components,calculated_at=excluded.calculated_at
  returning * into result;
  return result;
end; $$;
revoke all on function public.adminos_recalculate_application_health(uuid) from public, anon;
grant execute on function public.adminos_recalculate_application_health(uuid) to authenticated;

create or replace function public.adminos_application_health_application_trigger() returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.adminos_recalculate_application_health(new.id); return new; end; $$;
drop trigger if exists trg_adminos_application_health_application on public.applications;
create trigger trg_adminos_application_health_application after insert or update on public.applications for each row execute function public.adminos_application_health_application_trigger();

create or replace function public.adminos_application_health_document_trigger() returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.adminos_recalculate_application_health(new.application_id); return new; end; $$;
drop trigger if exists trg_adminos_application_health_document on public.application_documents;
create trigger trg_adminos_application_health_document after insert or update or delete on public.application_documents for each row execute function public.adminos_application_health_document_trigger();

create or replace function public.adminos_application_health_profile_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare x record; begin for x in select id from public.applications where user_id=new.id loop perform public.adminos_recalculate_application_health(x.id); end loop; return new; end; $$;
drop trigger if exists trg_adminos_application_health_profile on public.profiles;
create trigger trg_adminos_application_health_profile after update of full_name,email,phone,phone_number,campus,student_number on public.profiles for each row execute function public.adminos_application_health_profile_trigger();

do $$ declare x record; begin for x in select id from public.applications loop perform public.adminos_recalculate_application_health(x.id); end loop; end $$;