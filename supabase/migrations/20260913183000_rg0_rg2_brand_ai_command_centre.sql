-- RG0-RG2: Brand truth, ResKonnect AI positioning and My ResKonnect command centre.
-- Keeps AdminOS operational tables private while exposing a strictly auth.uid()-scoped student snapshot.

create or replace function public.my_reskonnect_command_centre()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile jsonb := '{}'::jsonb;
  v_course text;
  v_living jsonb := '{}'::jsonb;
  v_next_action jsonb;
  v_timeline jsonb := '[]'::jsonb;
  v_notifications jsonb := '[]'::jsonb;
  v_opportunities jsonb := '[]'::jsonb;
  v_service jsonb := '{}'::jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select
    jsonb_build_object(
      'full_name', p.full_name,
      'campus', p.campus,
      'course', p.course,
      'year_of_study', p.year_of_study,
      'academic_year', p.academic_year,
      'study_level', p.study_level,
      'student_stage', p.student_stage,
      'security_level', p.security_level
    ),
    p.course
  into v_profile, v_course
  from public.profiles p
  where p.id = v_uid
  limit 1;

  select jsonb_build_object(
    'application_count', count(*)::int,
    'submitted_count', count(*) filter (where lower(coalesce(a.status,'')) in ('submitted','pending','under_review','in_progress')),
    'approved_count', count(*) filter (where lower(coalesce(a.status,'')) in ('approved','placed','allocated')),
    'latest_health', (
      select jsonb_build_object(
        'application_id', h.application_id,
        'score', h.score,
        'health_band', h.health_band,
        'missing_items', coalesce(h.missing_items, '[]'::jsonb),
        'next_action_type', h.next_action_type,
        'next_action_url', h.next_action_url,
        'calculated_at', h.calculated_at
      )
      from public.adminos_application_health_scores h
      where h.user_id = v_uid
      order by h.calculated_at desc
      limit 1
    ),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id,
        'status', x.status,
        'created_at', x.created_at,
        'updated_at', x.updated_at,
        'residence_name', x.residence_name
      ) order by x.created_at desc)
      from (
        select a2.id, a2.status, a2.created_at, a2.updated_at, r.name as residence_name
        from public.applications a2
        left join public.residences r on r.id = a2.residence_id
        where a2.user_id = v_uid
        order by a2.created_at desc
        limit 4
      ) x
    ), '[]'::jsonb)
  )
  into v_living
  from public.applications a
  where a.user_id = v_uid;

  select jsonb_build_object(
    'id', a.id,
    'priority', a.priority,
    'action_type', a.action_type,
    'title', a.title,
    'rationale', a.rationale,
    'action_url', a.action_url,
    'generated_at', a.generated_at,
    'expires_at', a.expires_at
  )
  into v_next_action
  from public.adminos_next_best_actions a
  where a.user_id = v_uid
    and a.active = true
    and a.completed_at is null
    and (a.expires_at is null or a.expires_at > now())
  order by a.priority desc, a.generated_at desc
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'event_category', e.event_category,
    'event_type', e.event_type,
    'title', e.title,
    'summary', e.summary,
    'status', e.status,
    'occurred_at', e.occurred_at
  ) order by e.occurred_at desc), '[]'::jsonb)
  into v_timeline
  from (
    select *
    from public.adminos_customer_events
    where user_id = v_uid
    order by occurred_at desc
    limit 10
  ) e;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id,
    'title', n.title,
    'message', n.message,
    'type', n.type,
    'is_read', n.is_read,
    'created_at', n.created_at
  ) order by n.created_at desc), '[]'::jsonb)
  into v_notifications
  from (
    select *
    from public.notifications
    where user_id = v_uid
    order by created_at desc
    limit 8
  ) n;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'kind', q.kind,
    'title', q.title,
    'organisation', q.organisation,
    'closes_at', q.closes_at,
    'to_path', q.to_path,
    'match_reason', q.match_reason
  ) order by q.match_rank desc, q.closes_at asc nulls last), '[]'::jsonb)
  into v_opportunities
  from (
    select *
    from (
      select
        o.id,
        coalesce(nullif(o.opportunity_type,''), 'opportunity') as kind,
        o.title,
        o.organisation,
        o.closing_date as closes_at,
        '/opportunity/' || o.slug as to_path,
        case
          when nullif(trim(coalesce(v_course,'')), '') is not null
            and lower(concat_ws(' ', o.title, o.description, o.requirements)) like '%' || lower(trim(v_course)) || '%'
          then 'Matches your saved course context'
          else 'Verified published ResKonnect opportunity'
        end as match_reason,
        case
          when nullif(trim(coalesce(v_course,'')), '') is not null
            and lower(concat_ws(' ', o.title, o.description, o.requirements)) like '%' || lower(trim(v_course)) || '%'
          then 3 else 2
        end as match_rank
      from public.public_opportunities o
      where o.is_published = true
        and (o.closing_date is null or o.closing_date >= now())

      union all

      select
        b.id,
        'bursary' as kind,
        b.name as title,
        b.provider as organisation,
        b.deadline::timestamptz as closes_at,
        '/bursary/' || b.id::text as to_path,
        case
          when nullif(trim(coalesce(v_course,'')), '') is not null
            and lower(coalesce(b.fields_of_study::text,'') || ' ' || coalesce(b.description,'')) like '%' || lower(trim(v_course)) || '%'
          then 'Matches your saved course context'
          else 'Active ResKonnect bursary'
        end as match_reason,
        case
          when nullif(trim(coalesce(v_course,'')), '') is not null
            and lower(coalesce(b.fields_of_study::text,'') || ' ' || coalesce(b.description,'')) like '%' || lower(trim(v_course)) || '%'
          then 3 else 1
        end as match_rank
      from public.bursaries b
      where b.is_active = true
        and (b.deadline is null or b.deadline >= current_date)
    ) ranked
    order by match_rank desc, closes_at asc nulls last
    limit 6
  ) q;

  select coalesce(jsonb_build_object(
    'thread_id', t.id,
    'status', t.status,
    'priority', t.priority,
    'last_message_at', t.last_message_at,
    'resolved_at', t.resolved_at
  ), '{}'::jsonb)
  into v_service
  from public.adminos_enquiry_threads t
  where t.profile_user_id = v_uid
  order by t.last_message_at desc nulls last, t.created_at desc
  limit 1;

  return jsonb_build_object(
    'profile', coalesce(v_profile, '{}'::jsonb),
    'next_action', v_next_action,
    'living', coalesce(v_living, '{}'::jsonb),
    'opportunities', coalesce(v_opportunities, '[]'::jsonb),
    'timeline', coalesce(v_timeline, '[]'::jsonb),
    'notifications', coalesce(v_notifications, '[]'::jsonb),
    'service', coalesce(v_service, '{}'::jsonb),
    'generated_at', now()
  );
end;
$$;

revoke all on function public.my_reskonnect_command_centre() from public, anon;
grant execute on function public.my_reskonnect_command_centre() to authenticated, service_role;

update public.seo_pages
set
  title = 'ResKonnect | Living • AI • Opportunity',
  description = 'ResKonnect connects Living, AI and Opportunity in one integrated student platform for accommodation, intelligent guidance, applications, bursaries, WIL and verified opportunities.',
  h1 = 'Living, AI and opportunity — connected in one student platform',
  answer_summary = 'ResKonnect is an integrated Living, AI and Opportunity platform. Students can find accommodation, use grounded AI guidance, prepare applications and discover verified bursaries, WIL and other opportunities through one connected ResKonnect journey.',
  updated_at = now(),
  last_verified_at = now()
where path = '/';

update public.seo_pages
set
  title = 'ResKonnect AI | Grounded Student Guidance & Service Intelligence',
  description = 'Use ResKonnect AI across Living, applications and opportunities with verified platform context and account-aware next-step guidance when signed in.',
  h1 = 'ResKonnect AI: grounded guidance across your student journey',
  answer_summary = 'ResKonnect AI is the platform intelligence layer across Living, applications and opportunities. Luna is the website-facing agent and Dimpho is the WhatsApp-facing agent; both operate underneath the ResKonnect AI capability and use verified ResKonnect context where available.',
  updated_at = now(),
  last_verified_at = now()
where path = '/ai';

update public.seo_pages
set
  title = 'Find My Res | Verified Student Accommodation | ResKonnect',
  description = 'Find verified student accommodation by campus, area, budget, funding, room type and availability. Smart matching, maps, 3D exploration and navigation are optional ResKonnect Living capabilities.',
  h1 = 'Find the right place to live, faster',
  answer_summary = 'Find My Res is the accommodation discovery service inside ResKonnect Living. Students can search verified listings by practical criteria and optionally use smart matching, maps, 3D exploration and navigation.',
  updated_at = now(),
  last_verified_at = now()
where path = '/findmyres';
