-- Phase 10/10: Global AdminOS Search + Command Bar backend
-- Deterministic indexed lookup across customers, residences, applications, WIL and WhatsApp. No AI.

create index if not exists idx_adminos_contacts_full_name_lower on public.adminos_contacts(lower(full_name));
create index if not exists idx_adminos_contacts_email_lower on public.adminos_contacts(lower(email));
create index if not exists idx_adminos_contacts_phone on public.adminos_contacts(phone);
create index if not exists idx_profiles_full_name_lower on public.profiles(lower(full_name));
create index if not exists idx_profiles_email_lower on public.profiles(lower(email));
create index if not exists idx_profiles_student_number_lower on public.profiles(lower(student_number));
create index if not exists idx_residences_name_lower on public.residences(lower(name));

create or replace function public.adminos_global_search(p_query text,p_limit integer default 30)
returns table(
  result_type text,
  result_id uuid,
  title text,
  subtitle text,
  url text,
  score integer,
  metadata jsonb
)
language plpgsql security definer set search_path=public as $$
declare
  v_query text := lower(trim(coalesce(p_query,'')));
  v_digits text := regexp_replace(coalesce(p_query,''),'\D','','g');
  v_limit integer := greatest(1,least(coalesce(p_limit,30),60));
begin
  if not public.adminos_is_staff() then raise exception 'Staff access required'; end if;
  if length(v_query)<2 and length(v_digits)<4 then return; end if;

  return query
  with results as (
    select 'customer'::text as result_type,c.id as result_id,
      coalesce(nullif(c.full_name,''),nullif(c.email,''),nullif(c.phone,''),'Customer')::text as title,
      concat_ws(' · ',nullif(c.student_number,''),nullif(c.campus,''),nullif(c.email,''),nullif(c.phone,''))::text as subtitle,
      concat('/admin/system?tab=communications&contact=',c.id)::text as url,
      case when lower(coalesce(c.full_name,''))=v_query or lower(coalesce(c.email,''))=v_query or regexp_replace(coalesce(c.phone,''),'\D','','g')=v_digits then 100
           when lower(coalesce(c.full_name,'')) like v_query||'%' or lower(coalesce(c.email,'')) like v_query||'%' then 92 else 82 end::integer as score,
      jsonb_build_object('contact_id',c.id,'profile_user_id',c.profile_user_id,'phone',c.phone,'email',c.email,'student_number',c.student_number,'campus',c.campus,'contact_type',c.contact_type) as metadata
    from public.adminos_contacts c
    where c.merged_into_id is null and (
      lower(coalesce(c.full_name,'')) like '%'||v_query||'%' or
      lower(coalesce(c.email,'')) like '%'||v_query||'%' or
      lower(coalesce(c.student_number,'')) like '%'||v_query||'%' or
      regexp_replace(coalesce(c.phone,''),'\D','','g') like '%'||v_digits||'%'
    )

    union all

    select 'profile',p.id,
      coalesce(nullif(p.full_name,''),nullif(p.email,''),'Profile'),
      concat_ws(' · ',nullif(p.student_number,''),nullif(p.campus,''),nullif(p.course,''),nullif(p.email,'')),
      concat('/admin/system?tab=operations&profile=',p.id),
      case when lower(coalesce(p.full_name,''))=v_query or lower(coalesce(p.email,''))=v_query or lower(coalesce(p.student_number,''))=v_query then 98
           when lower(coalesce(p.full_name,'')) like v_query||'%' then 90 else 78 end,
      jsonb_build_object('user_id',p.id,'phone',coalesce(p.phone,p.phone_number),'email',p.email,'student_number',p.student_number,'campus',p.campus,'course',p.course)
    from public.profiles p
    where lower(coalesce(p.full_name,'')) like '%'||v_query||'%' or lower(coalesce(p.email,'')) like '%'||v_query||'%' or lower(coalesce(p.student_number,'')) like '%'||v_query||'%' or regexp_replace(coalesce(p.phone,p.phone_number,''),'\D','','g') like '%'||v_digits||'%'

    union all

    select 'residence',r.id,r.name,
      concat_ws(' · ',nullif(r.campus,''),nullif(r.city,''),case when r.price is not null then concat('R',r.price) end,case when r.available_spots is not null then concat(r.available_spots,' spots') end),
      concat('/admin/operations?tab=residences&residence=',r.id),
      case when lower(r.name)=v_query then 100 when lower(r.name) like v_query||'%' then 93 else 80 end,
      jsonb_build_object('slug',r.slug,'campus',r.campus,'city',r.city,'price',r.price,'available_spots',r.available_spots,'data_quality_score',r.data_quality_score,'service_ready',r.service_ready)
    from public.residences r
    where lower(coalesce(r.name,'')) like '%'||v_query||'%' or lower(coalesce(r.campus,'')) like '%'||v_query||'%' or lower(coalesce(r.city,'')) like '%'||v_query||'%' or lower(coalesce(r.address,'')) like '%'||v_query||'%'

    union all

    select 'application',a.id,concat('Application · ',coalesce(a.status,'unknown')),
      concat_ws(' · ',coalesce(p.full_name,'Unknown applicant'),coalesce(r.name,'No residence'),nullif(a.funding_type,'')),
      concat('/admin/operations?tab=applications&application=',a.id),
      case when a.id::text=v_query then 100 when lower(coalesce(p.full_name,'')) like v_query||'%' then 88 else 76 end,
      jsonb_build_object('application_id',a.id,'user_id',a.user_id,'residence_id',a.residence_id,'status',a.status,'funding_type',a.funding_type,'health_score',h.score,'health_band',h.health_band)
    from public.applications a
    left join public.profiles p on p.id=a.user_id
    left join public.residences r on r.id=a.residence_id
    left join public.adminos_application_health_scores h on h.application_id=a.id
    where a.id::text=v_query or lower(coalesce(p.full_name,'')) like '%'||v_query||'%' or lower(coalesce(p.student_number,'')) like '%'||v_query||'%' or lower(coalesce(r.name,'')) like '%'||v_query||'%'

    union all

    select 'wil_application',w.id,concat('WIL · ',coalesce(w.status,'unknown')),
      concat_ws(' · ',coalesce(w.full_name,p.full_name,'Applicant'),nullif(w.course,''),nullif(w.campus,'')),
      concat('/admin/system?tab=operations&wil=',w.id),
      case when w.id::text=v_query then 100 when lower(coalesce(w.full_name,p.full_name,'')) like v_query||'%' then 88 else 74 end,
      jsonb_build_object('wil_application_id',w.id,'student_id',w.student_id,'status',w.status,'course',w.course,'campus',w.campus,'funding_status',w.funding_status)
    from public.wil_applications w left join public.profiles p on p.id=w.student_id
    where w.id::text=v_query or lower(coalesce(w.full_name,p.full_name,'')) like '%'||v_query||'%' or lower(coalesce(p.student_number,'')) like '%'||v_query||'%' or lower(coalesce(w.course,'')) like '%'||v_query||'%'

    union all

    select 'whatsapp_thread',t.id,coalesce(c.full_name,t.channel_address,'WhatsApp conversation'),
      concat_ws(' · ',c.phone,t.status,t.mode,case when t.unread_count>0 then concat(t.unread_count,' unread') end),
      concat('/admin/system?tab=communications&thread=',t.id),
      case when regexp_replace(coalesce(c.phone,t.channel_address,''),'\D','','g')=v_digits then 99 when lower(coalesce(c.full_name,'')) like v_query||'%' then 90 else 75 end,
      jsonb_build_object('thread_id',t.id,'contact_id',t.contact_id,'status',t.status,'mode',t.mode,'priority',t.priority,'unread_count',t.unread_count,'language_code',t.language_code)
    from public.adminos_whatsapp_threads t left join public.adminos_contacts c on c.id=t.contact_id
    where lower(coalesce(c.full_name,'')) like '%'||v_query||'%' or lower(coalesce(c.email,'')) like '%'||v_query||'%' or regexp_replace(coalesce(c.phone,t.channel_address,''),'\D','','g') like '%'||v_digits||'%'
  )
  select r.result_type,r.result_id,r.title,r.subtitle,r.url,r.score,r.metadata
  from results r
  order by r.score desc,r.title asc
  limit v_limit;
end; $$;
revoke all on function public.adminos_global_search(text,integer) from public,anon;
grant execute on function public.adminos_global_search(text,integer) to authenticated;

create or replace function public.adminos_customer_360(p_contact_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.adminos_contacts%rowtype; profile_data jsonb; timeline_data jsonb; actions_data jsonb; recovery_data jsonb; application_data jsonb; result jsonb;
begin
  if not public.adminos_is_staff() then raise exception 'Staff access required'; end if;
  select * into c from public.adminos_contacts where id=p_contact_id;
  if c.id is null then raise exception 'Customer not found'; end if;
  select to_jsonb(p) into profile_data from public.profiles p where p.id=c.profile_user_id;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at desc),'[]'::jsonb) into timeline_data from (select * from public.adminos_customer_events where contact_id=c.id or (c.profile_user_id is not null and user_id=c.profile_user_id) order by occurred_at desc limit 80) e;
  select coalesce(jsonb_agg(to_jsonb(n) order by n.priority desc,n.generated_at desc),'[]'::jsonb) into actions_data from (select * from public.adminos_next_best_actions where (contact_id=c.id or (c.profile_user_id is not null and user_id=c.profile_user_id)) and active=true and completed_at is null order by priority desc limit 20) n;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.priority desc,s.last_detected_at desc),'[]'::jsonb) into recovery_data from (select * from public.adminos_service_recovery_items where contact_id=c.id and status in ('open','in_progress') order by priority desc limit 20) s;
  select coalesce(jsonb_agg(jsonb_build_object('application',to_jsonb(a),'health',to_jsonb(h),'residence',to_jsonb(r)) order by a.created_at desc),'[]'::jsonb) into application_data from public.applications a left join public.adminos_application_health_scores h on h.application_id=a.id left join public.residences r on r.id=a.residence_id where c.profile_user_id is not null and a.user_id=c.profile_user_id;
  result:=jsonb_build_object('contact',to_jsonb(c),'profile',profile_data,'timeline',timeline_data,'next_best_actions',actions_data,'service_recovery',recovery_data,'applications',application_data);
  return result;
end; $$;
revoke all on function public.adminos_customer_360(uuid) from public,anon;
grant execute on function public.adminos_customer_360(uuid) to authenticated;