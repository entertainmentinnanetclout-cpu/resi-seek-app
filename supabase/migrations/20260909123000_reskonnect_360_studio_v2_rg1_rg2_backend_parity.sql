-- ResKonnect 360 Studio V2 · RG1/RG2 production backend parity closure
-- Repairs legacy/live schema drift without removing newer RG3/RG4 capabilities.

create extension if not exists pgcrypto;

-- RG1 asset registry was skipped on production because an older 360 schema pre-dated V2.
create table if not exists public.virtual_tour_scene_assets (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid references public.virtual_tours(id) on delete cascade,
  scene_id uuid not null references public.virtual_tour_scenes(id) on delete cascade,
  asset_type text not null,
  bucket text not null,
  storage_path text not null,
  width integer,
  height integer,
  bytes bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists virtual_tour_scene_assets_scene_idx on public.virtual_tour_scene_assets(scene_id,created_at desc);
create index if not exists virtual_tour_scene_assets_tour_idx on public.virtual_tour_scene_assets(tour_id,created_at desc);
create unique index if not exists virtual_tour_scene_assets_path_idx on public.virtual_tour_scene_assets(bucket,storage_path);
alter table public.virtual_tour_scene_assets enable row level security;

drop policy if exists virtual_tour_scene_assets_manage on public.virtual_tour_scene_assets;
create policy virtual_tour_scene_assets_manage
on public.virtual_tour_scene_assets for all to authenticated
using (
  exists(
    select 1 from public.virtual_tour_scenes s
    join public.virtual_tours t on t.id=s.tour_id
    where s.id=virtual_tour_scene_assets.scene_id
      and (virtual_tour_scene_assets.tour_id is null or virtual_tour_scene_assets.tour_id=s.tour_id)
      and public.virtual_tour_can_manage(t.residence_id)
  )
)
with check (
  exists(
    select 1 from public.virtual_tour_scenes s
    join public.virtual_tours t on t.id=s.tour_id
    where s.id=virtual_tour_scene_assets.scene_id
      and (virtual_tour_scene_assets.tour_id is null or virtual_tour_scene_assets.tour_id=s.tour_id)
      and public.virtual_tour_can_manage(t.residence_id)
  )
);
grant select,insert,update,delete on public.virtual_tour_scene_assets to authenticated;

-- RG1 storage contract: raw capture/master media is private; publication delivery is public.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('tour-capture-private','tour-capture-private',false,26214400,array['image/jpeg','image/png','image/webp']),
('tour-masters-private','tour-masters-private',false,52428800,array['image/jpeg','image/png','image/webp']),
('tour-delivery-public','tour-delivery-public',true,26214400,array['image/jpeg','image/webp']),
('tour-thumbnails-public','tour-thumbnails-public',true,8388608,array['image/jpeg','image/webp'])
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists virtual_tour_assets_owner_insert on storage.objects;
create policy virtual_tour_assets_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id in ('tour-capture-private','tour-masters-private','tour-delivery-public','tour-thumbnails-public')
  and array_length(storage.foldername(name),1)>=1
  and ((storage.foldername(name))[1]) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.virtual_tour_can_manage(((storage.foldername(name))[1])::uuid)
);

drop policy if exists virtual_tour_assets_owner_update on storage.objects;
create policy virtual_tour_assets_owner_update on storage.objects
for update to authenticated
using (
  bucket_id in ('tour-capture-private','tour-masters-private','tour-delivery-public','tour-thumbnails-public')
  and array_length(storage.foldername(name),1)>=1
  and ((storage.foldername(name))[1]) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.virtual_tour_can_manage(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id in ('tour-capture-private','tour-masters-private','tour-delivery-public','tour-thumbnails-public')
  and array_length(storage.foldername(name),1)>=1
  and ((storage.foldername(name))[1]) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.virtual_tour_can_manage(((storage.foldername(name))[1])::uuid)
);

drop policy if exists virtual_tour_assets_owner_delete on storage.objects;
create policy virtual_tour_assets_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id in ('tour-capture-private','tour-masters-private','tour-delivery-public','tour-thumbnails-public')
  and array_length(storage.foldername(name),1)>=1
  and ((storage.foldername(name))[1]) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.virtual_tour_can_manage(((storage.foldername(name))[1])::uuid)
);

drop policy if exists virtual_tour_public_delivery_read on storage.objects;
create policy virtual_tour_public_delivery_read on storage.objects
for select to public
using (bucket_id in ('tour-delivery-public','tour-thumbnails-public'));

-- God Mode must be able to assign Premium/Gold entitlements; operators remain read-only.
drop policy if exists virtual_tour_entitlements_admin_all on public.virtual_tour_entitlements;
create policy virtual_tour_entitlements_admin_all
on public.virtual_tour_entitlements for all to authenticated
using (public.virtual_tour_is_admin())
with check (public.virtual_tour_is_admin());

drop policy if exists virtual_tour_entitlements_residence_read on public.virtual_tour_entitlements;
create policy virtual_tour_entitlements_residence_read
on public.virtual_tour_entitlements for select to authenticated
using (public.virtual_tour_can_manage_residence(residence_id));

-- RG2 quality engine. Internal processor is service-role only; interactive calls remain entitlement scoped.
create or replace function public.virtual_tour_scene_quality_upsert(
  p_scene_id uuid,
  p_metrics jsonb,
  p_privacy_issues jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_sharp numeric:=coalesce((p_metrics->>'sharpness')::numeric,0);
  v_light numeric:=coalesce((p_metrics->>'lighting')::numeric,0);
  v_cov numeric:=coalesce((p_metrics->>'coverage')::numeric,0);
  v_overlap numeric:=coalesce((p_metrics->>'overlap')::numeric,0);
  v_stability numeric:=coalesce((p_metrics->>'stability')::numeric,0);
  v_exposure numeric:=coalesce((p_metrics->>'exposure_consistency')::numeric,0);
  v_score numeric;
  v_min numeric;
  v_pass boolean;
  v_tour uuid;
  v_res uuid;
  v_internal boolean:=coalesce(auth.role(),'')='service_role';
begin
  select s.tour_id,t.residence_id into v_tour,v_res
  from public.virtual_tour_scenes s join public.virtual_tours t on t.id=s.tour_id
  where s.id=p_scene_id;
  if v_tour is null then raise exception 'Scene not found'; end if;
  if not v_internal and not public.virtual_tour_can_manage(v_res) then
    raise exception 'Tour access denied' using errcode='42501';
  end if;

  select coalesce(min_publish_quality,82) into v_min from public.virtual_tour_settings where id=1;
  v_min:=coalesce(v_min,82);
  v_score:=round((v_sharp*0.22+v_light*0.15+v_cov*0.24+v_overlap*0.14+v_stability*0.12+v_exposure*0.13)::numeric,2);
  v_pass:=v_score>=v_min and jsonb_array_length(coalesce(p_privacy_issues,'[]'::jsonb))=0;

  insert into public.virtual_tour_quality_reports(
    scene_id,overall_score,sharpness_score,lighting_score,coverage_score,overlap_score,
    stability_score,exposure_consistency_score,privacy_issues,passed,status,metadata
  ) values (
    p_scene_id,v_score,v_sharp,v_light,v_cov,v_overlap,v_stability,v_exposure,
    coalesce(p_privacy_issues,'[]'::jsonb),v_pass,
    case when v_pass then 'approved' else 'review_required' end,
    jsonb_build_object('engine','360-studio-v2','processor',case when v_internal then 'service_role' else 'interactive' end)
  );

  update public.virtual_tour_scenes set
    quality_score=v_score,
    capture_health=p_metrics,
    privacy_status=case when jsonb_array_length(coalesce(p_privacy_issues,'[]'::jsonb))=0 then 'clear' else 'issues' end,
    status=case when v_pass then 'ready' else 'review' end,
    updated_at=now()
  where id=p_scene_id;

  update public.virtual_tours
  set status=case when v_pass then 'review' else status end,updated_at=now()
  where id=v_tour and status<>'published';

  return jsonb_build_object('scene_id',p_scene_id,'score',v_score,'passed',v_pass,'min_quality',v_min,'privacy_clear',jsonb_array_length(coalesce(p_privacy_issues,'[]'::jsonb))=0);
end $$;
revoke all on function public.virtual_tour_scene_quality_upsert(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.virtual_tour_scene_quality_upsert(uuid,jsonb,jsonb) to authenticated,service_role;

-- Publish readiness is a Studio-only gate and uses the configured quality floor.
create or replace function public.virtual_tour_publish_readiness(p_tour_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_total int; v_ready int; v_below int; v_start int; v_min numeric;
begin
  select coalesce(min_publish_quality,82) into v_min from public.virtual_tour_settings where id=1;
  v_min:=coalesce(v_min,82);
  select count(*),count(*) filter(where status='ready'),count(*) filter(where coalesce(quality_score,0)<v_min),count(*) filter(where is_start=true)
  into v_total,v_ready,v_below,v_start
  from public.virtual_tour_scenes where tour_id=p_tour_id;
  return jsonb_build_object(
    'scene_total',v_total,'ready_scenes',v_ready,'below_quality',v_below,'min_quality',v_min,
    'start_scenes',v_start,'publishable',v_total>0 and v_ready=v_total and v_below=0 and v_start=1
  );
end $$;
revoke all on function public.virtual_tour_publish_readiness(uuid) from public,anon;
grant execute on function public.virtual_tour_publish_readiness(uuid) to authenticated;

-- Immutable RG2 publication: populate both legacy and V2 compatibility columns so RG3/RG4 discovery sees every new publish.
create or replace function public.virtual_tour_publish_snapshot(p_tour_id uuid,p_published_by uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_actor uuid:=auth.uid();
  v_tour public.virtual_tours%rowtype;
  v_ready jsonb;
  v_version int;
  v_snapshot jsonb;
  v_token uuid;
begin
  if v_actor is null or not public.virtual_tour_is_admin() then
    raise exception 'God Mode approval required' using errcode='42501';
  end if;
  if p_published_by is not null and p_published_by<>v_actor then raise exception 'Publisher identity mismatch'; end if;

  select * into v_tour from public.virtual_tours where id=p_tour_id for update;
  if v_tour.id is null then raise exception 'Tour not found'; end if;
  v_ready:=public.virtual_tour_publish_readiness(p_tour_id);
  if not coalesce((v_ready->>'publishable')::boolean,false) then raise exception 'Tour is not ready to publish'; end if;

  select coalesce(max(version_no),0)+1 into v_version from public.virtual_tour_versions where tour_id=p_tour_id;
  v_token:=coalesce(v_tour.public_token,gen_random_uuid());

  update public.virtual_tours set is_current=false,updated_at=now()
  where residence_id=v_tour.residence_id and id<>p_tour_id and status='published';
  update public.virtual_tour_scenes set status='published',updated_at=now()
  where tour_id=p_tour_id and status='ready';
  update public.virtual_tours set
    status='published',is_current=true,public_token=v_token,current_version=v_version,
    published_at=now(),verified_at=coalesce(verified_at,now()),
    verification_expires_at=coalesce(verification_expires_at,now()+interval '12 months'),updated_at=now()
  where id=p_tour_id returning * into v_tour;

  v_snapshot:=jsonb_build_object(
    'tour',to_jsonb(v_tour),
    'scenes',(select coalesce(jsonb_agg(to_jsonb(s) order by s.sort_order),'[]'::jsonb) from public.virtual_tour_scenes s where s.tour_id=p_tour_id and s.status='published'),
    'connections',(select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order),'[]'::jsonb) from public.virtual_tour_connections c where c.tour_id=p_tour_id and c.is_enabled),
    'hotspots',(select coalesce(jsonb_agg(to_jsonb(h) order by h.sort_order),'[]'::jsonb) from public.virtual_tour_hotspots h where h.tour_id=p_tour_id and h.is_enabled)
  );

  insert into public.virtual_tour_versions(tour_id,version_no,status,snapshot,created_by)
  values(p_tour_id,v_version,'published',v_snapshot,v_actor);

  update public.virtual_tour_publications p set status='superseded'
  where p.status='published' and (
    p.residence_id=v_tour.residence_id
    or exists(select 1 from public.virtual_tours ot where ot.id=p.tour_id and ot.residence_id=v_tour.residence_id)
  );

  insert into public.virtual_tour_publications(
    tour_id,version_no,status,published_by,residence_id,version_number,public_token,snapshot,valid_until,metadata
  ) values (
    p_tour_id,v_version,'published',v_actor,v_tour.residence_id,v_version,v_token,v_snapshot,
    now()+interval '12 months',jsonb_build_object('release','rg2','immutable',true,'schema','hybrid-v2')
  );

  return jsonb_build_object('ok',true,'tour_id',p_tour_id,'public_token',v_token,'version_number',v_version,'published_at',v_tour.published_at,'published_by',v_actor);
end $$;
revoke all on function public.virtual_tour_publish_snapshot(uuid,uuid) from public,anon;
grant execute on function public.virtual_tour_publish_snapshot(uuid,uuid) to authenticated;

-- Public viewer reads the immutable publication snapshot, not mutable Studio tables.
create or replace function public.virtual_tour_public_snapshot(p_public_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_pub public.virtual_tour_publications%rowtype; v_res jsonb; v_snap jsonb;
begin
  if not coalesce((select public_viewer_enabled from public.virtual_tour_settings where id=1),true) then return '{}'::jsonb; end if;
  select * into v_pub from public.virtual_tour_publications
  where public_token=p_public_token and status='published' and (valid_until is null or valid_until>now())
  order by published_at desc limit 1;
  if v_pub.id is null or v_pub.snapshot is null or v_pub.snapshot='{}'::jsonb then return '{}'::jsonb; end if;

  select jsonb_build_object(
    'id',r.id,'name',r.name,'slug',r.slug,'campus',r.campus,
    'address',coalesce(r.canonical_address,r.address),'cover_image_url',coalesce(r.cover_image_url,r.image_url),
    'price',r.price,'available_spots',r.available_spots,'accepts_nsfas',r.accepts_nsfas
  ) into v_res from public.residences r where r.id=v_pub.residence_id;

  v_snap:=v_pub.snapshot;
  return jsonb_build_object(
    'tour',coalesce(v_snap->'tour','{}'::jsonb),
    'residence',coalesce(v_res,'{}'::jsonb),
    'scenes',coalesce(v_snap->'scenes','[]'::jsonb),
    'connections',coalesce(v_snap->'connections','[]'::jsonb),
    'hotspots',coalesce(v_snap->'hotspots','[]'::jsonb),
    'publication',jsonb_build_object('version_number',coalesce(v_pub.version_number,v_pub.version_no),'published_at',v_pub.published_at,'valid_until',v_pub.valid_until)
  );
end $$;
revoke all on function public.virtual_tour_public_snapshot(uuid) from public;
grant execute on function public.virtual_tour_public_snapshot(uuid) to anon,authenticated;

-- Keep the release registry explicit and source-traceable.
insert into public.virtual_tour_release_registry(release_key,release_name,status,phases,metadata) values
('rg1','360 Studio V2 · Internal Capture Prototype','active',array[0,1,2,3],jsonb_build_object('version','v2','gate','live','capture','guided_mobile','offline',true,'storage_rls',true,'backend_parity','20260909123000')),
('rg2','360 Studio V2 · End-to-End Virtual Tour','active',array[4,5,6],jsonb_build_object('version','v2','gate','live','delivery','4k','versioned_publish',true,'immutable_public_snapshot',true,'processor_boundary','virtual-tour-processor','backend_parity','20260909123000'))
on conflict(release_key) do update set release_name=excluded.release_name,status=excluded.status,phases=excluded.phases,metadata=excluded.metadata,updated_at=now();

-- Reassert intended table privileges; RLS remains the authoritative boundary.
grant select,insert,update,delete on public.virtual_tours to authenticated;
grant select,insert,update,delete on public.virtual_tour_scenes to authenticated;
grant select,insert,update,delete on public.virtual_tour_capture_sessions to authenticated;
grant select,insert,update,delete on public.virtual_tour_capture_frames to authenticated;
grant select,insert,update,delete on public.virtual_tour_processing_jobs to authenticated;
grant select,insert,update,delete on public.virtual_tour_quality_reports to authenticated;
grant select,insert,update,delete on public.virtual_tour_connections to authenticated;
grant select,insert,update,delete on public.virtual_tour_hotspots to authenticated;
grant select on public.virtual_tour_versions to authenticated;
grant select on public.virtual_tour_publications to authenticated;
grant select,insert on public.virtual_tour_analytics to authenticated;
grant select,insert,update,delete on public.virtual_tour_entitlements to authenticated;
grant select on public.virtual_tour_release_registry to authenticated;
