-- 360 Studio standalone workspace + relationship-safe authorization.
-- A virtual tour can belong to a residence OR be an authenticated user's standalone project.

alter table public.virtual_tours alter column residence_id drop not null;
alter table public.virtual_tours add column if not exists workspace_type text not null default 'residence';
alter table public.virtual_tours add column if not exists workspace_label text;
update public.virtual_tours set workspace_type='residence' where workspace_type is null or workspace_type='';

alter table public.virtual_tours drop constraint if exists virtual_tours_quality_tier_check;
alter table public.virtual_tours add constraint virtual_tours_quality_tier_check
  check (quality_tier = any(array['internal'::text,'premium'::text,'gold'::text,'standalone'::text]));
alter table public.virtual_tours drop constraint if exists virtual_tours_workspace_type_check;
alter table public.virtual_tours add constraint virtual_tours_workspace_type_check
  check (workspace_type in ('residence','standalone'));
alter table public.virtual_tours drop constraint if exists virtual_tours_workspace_owner_check;
alter table public.virtual_tours add constraint virtual_tours_workspace_owner_check
  check ((workspace_type='residence' and residence_id is not null) or (workspace_type='standalone' and residence_id is null and created_by is not null));
create index if not exists virtual_tours_creator_workspace_idx on public.virtual_tours(created_by,workspace_type,updated_at desc);

create or replace function public.virtual_tour_can_manage_tour(p_tour_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((
    select public.virtual_tour_is_admin()
      or (t.workspace_type='standalone' and t.created_by=auth.uid())
      or (t.residence_id is not null and public.virtual_tour_can_manage(t.residence_id))
    from public.virtual_tours t where t.id=p_tour_id
  ),false);
$$;
revoke all on function public.virtual_tour_can_manage_tour(uuid) from public,anon;
grant execute on function public.virtual_tour_can_manage_tour(uuid) to authenticated,service_role;

create or replace function public.virtual_tour_can_manage_storage_scope(p_scope uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.virtual_tour_is_admin()
    or public.virtual_tour_can_manage(p_scope)
    or exists(select 1 from public.virtual_tours t where t.id=p_scope and public.virtual_tour_can_manage_tour(t.id));
$$;
revoke all on function public.virtual_tour_can_manage_storage_scope(uuid) from public,anon;
grant execute on function public.virtual_tour_can_manage_storage_scope(uuid) to authenticated,service_role;

-- Parent tour policy: inserts are evaluated from NEW, child policies use tour-level ownership.
drop policy if exists virtual_tours_manage_all on public.virtual_tours;
create policy virtual_tours_manage_all on public.virtual_tours for all to authenticated
using (
  public.virtual_tour_is_admin()
  or (workspace_type='standalone' and created_by=auth.uid())
  or (residence_id is not null and public.virtual_tour_can_manage(residence_id))
)
with check (
  public.virtual_tour_is_admin()
  or (workspace_type='standalone' and created_by=auth.uid() and residence_id is null)
  or (workspace_type='residence' and residence_id is not null and public.virtual_tour_can_manage(residence_id))
);

-- Rebuild all editable child policies against the owning tour instead of a required residence.
drop policy if exists virtual_tour_scenes_manage_all on public.virtual_tour_scenes;
create policy virtual_tour_scenes_manage_all on public.virtual_tour_scenes for all to authenticated
using (public.virtual_tour_can_manage_tour(tour_id)) with check (public.virtual_tour_can_manage_tour(tour_id));

drop policy if exists virtual_capture_sessions_manage_all on public.virtual_tour_capture_sessions;
create policy virtual_capture_sessions_manage_all on public.virtual_tour_capture_sessions for all to authenticated
using (exists(select 1 from public.virtual_tour_scenes s where s.id=scene_id and public.virtual_tour_can_manage_tour(s.tour_id)))
with check (exists(select 1 from public.virtual_tour_scenes s where s.id=scene_id and public.virtual_tour_can_manage_tour(s.tour_id)));

drop policy if exists virtual_capture_frames_manage_all on public.virtual_tour_capture_frames;
create policy virtual_capture_frames_manage_all on public.virtual_tour_capture_frames for all to authenticated
using (exists(select 1 from public.virtual_tour_capture_sessions cs join public.virtual_tour_scenes s on s.id=cs.scene_id where cs.id=session_id and public.virtual_tour_can_manage_tour(s.tour_id)))
with check (exists(select 1 from public.virtual_tour_capture_sessions cs join public.virtual_tour_scenes s on s.id=cs.scene_id where cs.id=session_id and public.virtual_tour_can_manage_tour(s.tour_id)));

drop policy if exists virtual_connections_manage_all on public.virtual_tour_connections;
create policy virtual_connections_manage_all on public.virtual_tour_connections for all to authenticated
using (public.virtual_tour_can_manage_tour(tour_id)) with check (public.virtual_tour_can_manage_tour(tour_id));

drop policy if exists virtual_hotspots_manage_all on public.virtual_tour_hotspots;
create policy virtual_hotspots_manage_all on public.virtual_tour_hotspots for all to authenticated
using (public.virtual_tour_can_manage_tour(tour_id)) with check (public.virtual_tour_can_manage_tour(tour_id));

drop policy if exists virtual_jobs_manage_all on public.virtual_tour_processing_jobs;
create policy virtual_jobs_manage_all on public.virtual_tour_processing_jobs for all to authenticated
using (tour_id is not null and public.virtual_tour_can_manage_tour(tour_id))
with check (tour_id is not null and public.virtual_tour_can_manage_tour(tour_id));

drop policy if exists virtual_publications_manage_all on public.virtual_tour_publications;
create policy virtual_publications_manage_select on public.virtual_tour_publications for select to authenticated
using (public.virtual_tour_can_manage_tour(tour_id));

drop policy if exists virtual_quality_manage_all on public.virtual_tour_quality_reports;
create policy virtual_quality_manage_all on public.virtual_tour_quality_reports for all to authenticated
using (exists(select 1 from public.virtual_tour_scenes s where s.id=scene_id and public.virtual_tour_can_manage_tour(s.tour_id)))
with check (exists(select 1 from public.virtual_tour_scenes s where s.id=scene_id and public.virtual_tour_can_manage_tour(s.tour_id)));

drop policy if exists virtual_tour_scene_assets_manage on public.virtual_tour_scene_assets;
create policy virtual_tour_scene_assets_manage on public.virtual_tour_scene_assets for all to authenticated
using (exists(select 1 from public.virtual_tour_scenes s where s.id=scene_id and (tour_id is null or tour_id=s.tour_id) and public.virtual_tour_can_manage_tour(s.tour_id)))
with check (exists(select 1 from public.virtual_tour_scenes s where s.id=scene_id and (tour_id is null or tour_id=s.tour_id) and public.virtual_tour_can_manage_tour(s.tour_id)));

drop policy if exists virtual_versions_manage_all on public.virtual_tour_versions;
create policy virtual_versions_manage_select on public.virtual_tour_versions for select to authenticated
using (public.virtual_tour_can_manage_tour(tour_id));

drop policy if exists virtual_tour_analytics_manager_read on public.virtual_tour_analytics;
create policy virtual_tour_analytics_manager_read on public.virtual_tour_analytics for select to authenticated
using (public.virtual_tour_can_manage_tour(tour_id));

-- Storage path segment 1 is either a legacy residence UUID or a standalone tour UUID.
drop policy if exists tour_asset_manage_delete on storage.objects;
drop policy if exists tour_asset_manage_insert on storage.objects;
drop policy if exists tour_asset_manage_update on storage.objects;
drop policy if exists tour_private_manage_select on storage.objects;
drop policy if exists virtual_tour_assets_owner_delete on storage.objects;
drop policy if exists virtual_tour_assets_owner_insert on storage.objects;
drop policy if exists virtual_tour_assets_owner_update on storage.objects;

create policy virtual_tour_assets_manage_insert on storage.objects for insert to authenticated
with check (bucket_id=any(array['tour-capture-private','tour-masters-private','tour-delivery-public','tour-thumbnails-public']) and array_length(storage.foldername(name),1)>=1 and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and public.virtual_tour_can_manage_storage_scope(((storage.foldername(name))[1])::uuid));
create policy virtual_tour_assets_manage_update on storage.objects for update to authenticated
using (bucket_id=any(array['tour-capture-private','tour-masters-private','tour-delivery-public','tour-thumbnails-public']) and array_length(storage.foldername(name),1)>=1 and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and public.virtual_tour_can_manage_storage_scope(((storage.foldername(name))[1])::uuid))
with check (bucket_id=any(array['tour-capture-private','tour-masters-private','tour-delivery-public','tour-thumbnails-public']) and array_length(storage.foldername(name),1)>=1 and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and public.virtual_tour_can_manage_storage_scope(((storage.foldername(name))[1])::uuid));
create policy virtual_tour_assets_manage_delete on storage.objects for delete to authenticated
using (bucket_id=any(array['tour-capture-private','tour-masters-private','tour-delivery-public','tour-thumbnails-public']) and array_length(storage.foldername(name),1)>=1 and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and public.virtual_tour_can_manage_storage_scope(((storage.foldername(name))[1])::uuid));
create policy virtual_tour_private_manage_select on storage.objects for select to authenticated
using (bucket_id=any(array['tour-capture-private','tour-masters-private']) and array_length(storage.foldername(name),1)>=1 and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and public.virtual_tour_can_manage_storage_scope(((storage.foldername(name))[1])::uuid));

create or replace function public.virtual_tour_enforce_scene_entitlement()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_tour public.virtual_tours%rowtype; v_plan text; v_entitlements text[]; v_scene_count integer;
begin
  if auth.role()='service_role' or public.virtual_tour_is_admin() then return new; end if;
  select * into v_tour from public.virtual_tours where id=new.tour_id;
  if v_tour.id is null then raise exception '360 Studio tour not found' using errcode='P0001'; end if;
  select count(*) into v_scene_count from public.virtual_tour_scenes where tour_id=new.tour_id;
  if v_scene_count>=120 then raise exception '360 Studio scene safety limit reached' using errcode='P0001'; end if;
  if v_tour.workspace_type='standalone' then
    if v_tour.created_by<>auth.uid() then raise exception 'Standalone 360 project access denied' using errcode='42501'; end if;
    return new;
  end if;
  if v_tour.residence_id is null or not public.virtual_tour_can_manage_residence(v_tour.residence_id) then raise exception '360 Studio residence access denied' using errcode='42501'; end if;
  select plan,entitlements into v_plan,v_entitlements from public.virtual_tour_entitlements
    where residence_id=v_tour.residence_id and is_active=true and (expires_at is null or expires_at>now()) order by updated_at desc limit 1;
  if coalesce(v_plan,'standard') not in ('premium','gold','internal') and not ('virtual_tour.create'=any(coalesce(v_entitlements,'{}'::text[]))) then
    raise exception '360 Studio Premium or Gold entitlement required' using errcode='42501';
  end if;
  if v_plan='premium' and not ('virtual_tour.unlimited_scenes'=any(coalesce(v_entitlements,'{}'::text[]))) and v_scene_count>=36 then
    raise exception 'Premium includes up to 36 scenes. Upgrade to Gold for extended scene capacity.' using errcode='P0001';
  end if;
  return new;
end $$;
revoke all on function public.virtual_tour_enforce_scene_entitlement() from public,anon,authenticated;
grant execute on function public.virtual_tour_enforce_scene_entitlement() to service_role;

create or replace function public.virtual_tour_scene_quality_upsert(p_scene_id uuid,p_metrics jsonb,p_privacy_issues jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_sharp numeric:=coalesce((p_metrics->>'sharpness')::numeric,0); v_light numeric:=coalesce((p_metrics->>'lighting')::numeric,0); v_cov numeric:=coalesce((p_metrics->>'coverage')::numeric,0); v_overlap numeric:=coalesce((p_metrics->>'overlap')::numeric,0); v_stability numeric:=coalesce((p_metrics->>'stability')::numeric,0); v_exposure numeric:=coalesce((p_metrics->>'exposure_consistency')::numeric,0); v_score numeric; v_min numeric; v_pass boolean; v_tour uuid; v_internal boolean:=coalesce(auth.role(),'')='service_role';
begin
  select s.tour_id into v_tour from public.virtual_tour_scenes s where s.id=p_scene_id;
  if v_tour is null then raise exception 'Scene not found'; end if;
  if not v_internal and not public.virtual_tour_can_manage_tour(v_tour) then raise exception 'Tour access denied' using errcode='42501'; end if;
  select coalesce(min_publish_quality,82) into v_min from public.virtual_tour_settings where id=1; v_min:=coalesce(v_min,82);
  v_score:=round((v_sharp*.22+v_light*.15+v_cov*.24+v_overlap*.14+v_stability*.12+v_exposure*.13)::numeric,2);
  v_pass:=v_score>=v_min and jsonb_array_length(coalesce(p_privacy_issues,'[]'::jsonb))=0;
  insert into public.virtual_tour_quality_reports(scene_id,overall_score,sharpness_score,lighting_score,coverage_score,overlap_score,stability_score,exposure_consistency_score,privacy_issues,passed,status,metadata)
  values(p_scene_id,v_score,v_sharp,v_light,v_cov,v_overlap,v_stability,v_exposure,coalesce(p_privacy_issues,'[]'::jsonb),v_pass,case when v_pass then 'approved' else 'review_required' end,jsonb_build_object('engine','360-studio-v3','processor',case when v_internal then 'service_role' else 'interactive' end));
  update public.virtual_tour_scenes set quality_score=v_score,capture_health=p_metrics,privacy_status=case when jsonb_array_length(coalesce(p_privacy_issues,'[]'::jsonb))=0 then 'clear' else 'issues' end,status=case when v_pass then 'ready' else 'review' end,updated_at=now() where id=p_scene_id;
  update public.virtual_tours set status=case when v_pass then 'review' else status end,updated_at=now() where id=v_tour and status<>'published';
  return jsonb_build_object('scene_id',p_scene_id,'score',v_score,'passed',v_pass,'min_quality',v_min,'privacy_clear',jsonb_array_length(coalesce(p_privacy_issues,'[]'::jsonb))=0);
end $$;
revoke all on function public.virtual_tour_scene_quality_upsert(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.virtual_tour_scene_quality_upsert(uuid,jsonb,jsonb) to authenticated,service_role;

create or replace function public.virtual_tour_publish_snapshot(p_tour_id uuid,p_published_by uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_tour public.virtual_tours%rowtype; v_ready jsonb; v_version int; v_snapshot jsonb; v_token uuid; v_admin boolean;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  v_admin:=public.virtual_tour_is_admin();
  select * into v_tour from public.virtual_tours where id=p_tour_id for update;
  if v_tour.id is null then raise exception 'Tour not found'; end if;
  if not v_admin and not (v_tour.workspace_type='standalone' and v_tour.created_by=v_actor) then raise exception 'God Mode approval required for residence publishing' using errcode='42501'; end if;
  if p_published_by is not null and p_published_by<>v_actor then raise exception 'Publisher identity mismatch'; end if;
  v_ready:=public.virtual_tour_publish_readiness(p_tour_id);
  if not coalesce((v_ready->>'publishable')::boolean,false) then raise exception 'Tour is not ready to publish'; end if;
  select coalesce(max(version_no),0)+1 into v_version from public.virtual_tour_versions where tour_id=p_tour_id;
  v_token:=coalesce(v_tour.public_token,gen_random_uuid());
  if v_tour.residence_id is not null then
    update public.virtual_tours set is_current=false,updated_at=now() where residence_id=v_tour.residence_id and id<>p_tour_id and status='published';
    update public.virtual_tour_publications set status='superseded' where status='published' and residence_id=v_tour.residence_id;
  else
    update public.virtual_tour_publications set status='superseded' where status='published' and tour_id=p_tour_id;
  end if;
  update public.virtual_tour_scenes set status='published',updated_at=now() where tour_id=p_tour_id and status='ready';
  update public.virtual_tours set status='published',is_current=true,public_token=v_token,current_version=v_version,published_at=now(),verified_at=coalesce(verified_at,now()),verification_expires_at=coalesce(verification_expires_at,now()+interval '12 months'),updated_at=now() where id=p_tour_id returning * into v_tour;
  v_snapshot:=jsonb_build_object('tour',to_jsonb(v_tour),'workspace',jsonb_build_object('type',v_tour.workspace_type,'label',coalesce(v_tour.workspace_label,v_tour.title)),'scenes',(select coalesce(jsonb_agg(to_jsonb(s) order by s.sort_order),'[]'::jsonb) from public.virtual_tour_scenes s where s.tour_id=p_tour_id and s.status='published'),'connections',(select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order),'[]'::jsonb) from public.virtual_tour_connections c where c.tour_id=p_tour_id and c.is_enabled),'hotspots',(select coalesce(jsonb_agg(to_jsonb(h) order by h.sort_order),'[]'::jsonb) from public.virtual_tour_hotspots h where h.tour_id=p_tour_id and h.is_enabled));
  insert into public.virtual_tour_versions(tour_id,version_no,status,snapshot,created_by) values(p_tour_id,v_version,'published',v_snapshot,v_actor);
  insert into public.virtual_tour_publications(tour_id,version_no,status,published_by,residence_id,version_number,public_token,snapshot,valid_until,metadata)
  values(p_tour_id,v_version,'published',v_actor,v_tour.residence_id,v_version,v_token,v_snapshot,now()+interval '12 months',jsonb_build_object('release','standalone-v3','immutable',true,'workspace_type',v_tour.workspace_type));
  return jsonb_build_object('ok',true,'tour_id',p_tour_id,'workspace_type',v_tour.workspace_type,'public_token',v_token,'version_number',v_version,'published_at',v_tour.published_at,'published_by',v_actor);
end $$;
revoke all on function public.virtual_tour_publish_snapshot(uuid,uuid) from public,anon;
grant execute on function public.virtual_tour_publish_snapshot(uuid,uuid) to authenticated,service_role;

create or replace function public.virtual_tour_public_snapshot(p_public_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_pub public.virtual_tour_publications%rowtype; v_res jsonb; v_snap jsonb;
begin
  if not coalesce((select public_viewer_enabled from public.virtual_tour_settings where id=1),true) then return '{}'::jsonb; end if;
  select * into v_pub from public.virtual_tour_publications where public_token=p_public_token and status='published' and (valid_until is null or valid_until>now()) order by published_at desc limit 1;
  if v_pub.id is null or v_pub.snapshot is null or v_pub.snapshot='{}'::jsonb then return '{}'::jsonb; end if;
  if v_pub.residence_id is not null then
    select jsonb_build_object('id',r.id,'name',r.name,'slug',r.slug,'campus',r.campus,'address',coalesce(r.canonical_address,r.address),'cover_image_url',coalesce(r.cover_image_url,r.image_url),'price',r.price,'available_spots',r.available_spots,'accepts_nsfas',r.accepts_nsfas) into v_res from public.residences r where r.id=v_pub.residence_id;
  else v_res:=null; end if;
  v_snap:=v_pub.snapshot;
  return jsonb_build_object('tour',coalesce(v_snap->'tour','{}'::jsonb),'workspace',coalesce(v_snap->'workspace',jsonb_build_object('type',coalesce(v_snap->'tour'->>'workspace_type','residence'),'label',v_snap->'tour'->>'title')),'residence',v_res,'scenes',coalesce(v_snap->'scenes','[]'::jsonb),'connections',coalesce(v_snap->'connections','[]'::jsonb),'hotspots',coalesce(v_snap->'hotspots','[]'::jsonb),'publication',jsonb_build_object('version_number',coalesce(v_pub.version_number,v_pub.version_no),'published_at',v_pub.published_at,'valid_until',v_pub.valid_until));
end $$;
revoke all on function public.virtual_tour_public_snapshot(uuid) from public;
grant execute on function public.virtual_tour_public_snapshot(uuid) to anon,authenticated,service_role;

create or replace function public.virtual_tour_admin_summary()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.virtual_tour_is_admin() then raise exception 'God Mode required' using errcode='42501'; end if;
 return jsonb_build_object('tours',(select count(*) from public.virtual_tours),'standalone',(select count(*) from public.virtual_tours where workspace_type='standalone'),'published',(select count(*) from public.virtual_tours where status='published'),'scenes',(select count(*) from public.virtual_tour_scenes),'processing',(select count(*) from public.virtual_tour_processing_jobs where status in ('queued','running')),'failed',(select count(*) from public.virtual_tour_processing_jobs where status='failed'),'avg_quality',(select coalesce(round(avg(quality_score),1),0) from public.virtual_tour_scenes where quality_score is not null),'views_30d',(select count(*) from public.virtual_tour_analytics where event_type='tour_open' and created_at>now()-interval '30 days'));
end $$;
revoke all on function public.virtual_tour_admin_summary() from public,anon;
grant execute on function public.virtual_tour_admin_summary() to authenticated,service_role;
