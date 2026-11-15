-- SEC-04 / SEC-21 / SEC-25 — public read RPC privacy and input constraints
-- Source: live PostgreSQL definitions captured from project mefjzkhobkltlbmhusdh on 15 Nov 2026.
-- Existing signatures, return shapes, grants, referral browser flow, standalone tours and published feeds stay unchanged.
-- No customer data, functions or columns dropped.
CREATE OR REPLACE FUNCTION public.get_referral_public(_code text)
 RETURNS TABLE(code text, agent_name text, is_active boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _c text;
BEGIN
  -- Prevent excessive public inputs and avoid running code normalization on unbounded data.
  if _code is null or octet_length(_code)>100 or length(trim(_code)) not between 2 and 100 then
    return;
  end if;
  _c := public.normalize_referral_code(_code);
  RETURN QUERY
    SELECT rc.code,
           COALESCE(p.full_name, 'A ResKonnect Recruiter') AS agent_name,
           COALESCE(rc.is_active, false) AS is_active
    FROM public.referral_codes rc
    LEFT JOIN public.profiles p ON p.id = rc.user_id
    WHERE rc.code = _c AND rc.is_active = true
    LIMIT 1;
END $function$;

CREATE OR REPLACE FUNCTION public.virtual_tour_public_snapshot(p_public_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare v_pub public.virtual_tour_publications%rowtype; v_res jsonb; v_snap jsonb; begin if not coalesce((select public_viewer_enabled from public.virtual_tour_settings where id=1),true) then return '{}'::jsonb; end if; select * into v_pub from public.virtual_tour_publications where public_token=p_public_token and status='published' and (valid_until is null or valid_until>now()) order by published_at desc limit 1; if v_pub.id is null or v_pub.snapshot is null or v_pub.snapshot='{}'::jsonb then return '{}'::jsonb; end if;
 -- A published token must not expose a residence after the listing has been hidden.
 -- Standalone published workspaces with no residence stay publicly viewable.
 if v_pub.residence_id is not null and not exists (
   select 1 from public.residences r
   where r.id = v_pub.residence_id and r.is_visible = true
 ) then return '{}'::jsonb; end if;
 if v_pub.residence_id is not null then select jsonb_build_object('id',r.id,'name',r.name,'slug',r.slug,'campus',r.campus,'address',coalesce(r.canonical_address,r.address),'cover_image_url',coalesce(r.cover_image_url,r.image_url),'price',r.price,'available_spots',r.available_spots,'accepts_nsfas',r.accepts_nsfas) into v_res from public.residences r where r.id=v_pub.residence_id and r.is_visible=true; else v_res:=null; end if; v_snap:=v_pub.snapshot; return jsonb_build_object('tour',coalesce(v_snap->'tour','{}'::jsonb),'workspace',coalesce(v_snap->'workspace',jsonb_build_object('type',coalesce(v_snap->'tour'->>'workspace_type','residence'),'label',v_snap->'tour'->>'title')),'residence',v_res,'scenes',coalesce(v_snap->'scenes','[]'::jsonb),'connections',coalesce(v_snap->'connections','[]'::jsonb),'hotspots',coalesce(v_snap->'hotspots','[]'::jsonb),'publication',jsonb_build_object('version_number',coalesce(v_pub.version_number,v_pub.version_no),'published_at',v_pub.published_at,'valid_until',v_pub.valid_until)); end $function$;

CREATE OR REPLACE FUNCTION public.reskonnect_opportunity_feed(p_query text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_limit integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_course text;
  v_campus text;
  v_limit integer:=least(greatest(coalesce(p_limit,60),1),100);
  v_items jsonb:='[]'::jsonb;
begin
  -- Bound untrusted SQL search inputs before any privileged profile or feed query.
  if octet_length(coalesce(p_query,''))>256 or octet_length(coalesce(p_type,''))>96 then
    raise exception 'Search input is too long' using errcode='22023';
  end if;
  if v_uid is not null then
    select nullif(trim(course),''),nullif(trim(campus),'')
      into v_course,v_campus
    from public.profiles where id=v_uid;
  end if;

  with unified as (
    select
      o.id,
      'public_opportunity'::text as source_type,
      o.slug,
      '/opportunity/'||o.slug as to_path,
      o.title,
      coalesce(nullif(o.opportunity_type,''),'opportunity') as opportunity_type,
      o.organisation,
      o.location,
      o.province,
      o.description,
      o.requirements,
      o.application_url,
      o.closing_date,
      o.date_posted,
      o.employment_type,
      o.last_verified_at,
      jsonb_build_object(
        'source_url',o.metadata->>'source_url',
        'source_class',o.metadata->>'source_class',
        'official_confirmation_required',coalesce((o.metadata->>'official_confirmation_required')::boolean,true)
      ) as metadata,
      concat_ws(' ',o.title,o.opportunity_type,o.organisation,o.location,o.province,o.description,o.requirements,o.employment_type) as search_text
    from public.public_opportunities o
    where o.is_published=true
      and (o.closing_date is null or o.closing_date>=now())

    union all

    select
      b.id,
      'bursary'::text,
      null::text,
      '/bursary/'||b.id::text,
      b.name,
      'bursary'::text,
      b.provider,
      null::text,
      null::text,
      b.description,
      array_to_string(b.requirements,E'\n'),
      b.link,
      case when b.deadline is null then null else (b.deadline::timestamp + interval '23 hours 59 minutes') at time zone 'Africa/Johannesburg' end,
      b.created_at,
      'bursary'::text,
      b.last_verified_at,
      jsonb_build_object(
        'amount',b.amount,
        'fields_of_study',b.fields_of_study,
        'verification_status',b.verification_status,
        'source_url',b.source_url,
        'source_class',b.metadata->>'source_class',
        'official_confirmation_required',coalesce((b.metadata->>'official_confirmation_required')::boolean,true)
      ),
      concat_ws(' ',b.name,b.provider,b.description,array_to_string(b.fields_of_study,' '),array_to_string(b.requirements,' '),b.type)
    from public.bursaries b
    where b.is_active=true
      and (b.deadline is null or b.deadline>=current_date)
  ),
  filtered as (
    select *,
      case
        when v_uid is null then 50
        when v_course is not null and lower(search_text) like '%'||lower(v_course)||'%' then 90
        when v_campus is not null and lower(search_text) like '%'||lower(v_campus)||'%' then 75
        else 60
      end as match_score,
      case
        when v_uid is null then 'Sign in to add your profile context'
        when v_course is not null and lower(search_text) like '%'||lower(v_course)||'%' then 'Strong textual match to your saved course'
        when v_campus is not null and lower(search_text) like '%'||lower(v_campus)||'%' then 'Matches your saved campus/location context'
        else 'Current verified opportunity available on ResKonnect'
      end as match_reason
    from unified
    where
      (nullif(trim(coalesce(p_query,'')),'') is null or lower(search_text) like '%'||lower(trim(p_query))||'%')
      and (
        nullif(trim(coalesce(p_type,'')),'') is null
        or lower(source_type)=lower(trim(p_type))
        or lower(opportunity_type)=lower(trim(p_type))
        or lower(opportunity_type) like '%'||lower(trim(p_type))||'%'
      )
  ),
  ranked as (
    select * from filtered
    order by match_score desc, closing_date asc nulls last, date_posted desc nulls last
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,
    'source_type',r.source_type,
    'slug',r.slug,
    'to_path',r.to_path,
    'title',r.title,
    'opportunity_type',r.opportunity_type,
    'organisation',r.organisation,
    'location',r.location,
    'province',r.province,
    'description',r.description,
    'requirements',r.requirements,
    'application_url',r.application_url,
    'closing_date',r.closing_date,
    'date_posted',r.date_posted,
    'employment_type',r.employment_type,
    'last_verified_at',r.last_verified_at,
    'verification_state',case
      when r.last_verified_at is null then 'verification_due'
      when r.last_verified_at>=now()-interval '30 days' then 'verified'
      else 'review_due'
    end,
    'match_score',r.match_score,
    'match_reason',r.match_reason,
    'user_action',case when v_uid is null then null else (
      select a.action from public.student_opportunity_actions a
      where a.user_id=v_uid and a.source_type=r.source_type and a.source_id=r.id
      limit 1
    ) end,
    'metadata',r.metadata
  ) order by r.match_score desc,r.closing_date asc nulls last), '[]'::jsonb)
  into v_items
  from ranked r;

  return jsonb_build_object(
    'items',v_items,
    'authenticated',v_uid is not null,
    'profile_context',case when v_uid is null then null else jsonb_build_object('course',v_course,'campus',v_campus) end,
    'generated_at',now()
  );
end;
$function$;
