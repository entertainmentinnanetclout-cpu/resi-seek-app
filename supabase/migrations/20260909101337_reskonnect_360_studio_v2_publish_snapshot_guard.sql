-- Harden publication so published_by is always the authenticated God Mode user.
create or replace function public.virtual_tour_publish_snapshot(p_tour_id uuid,p_published_by uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_tour public.virtual_tours%rowtype; v_ready jsonb; v_version int; v_snapshot jsonb; v_token uuid; v_actor uuid;
begin
  v_actor := auth.uid();
  if v_actor is null or not public.virtual_tour_is_admin() then raise exception 'God Mode approval required'; end if;
  if p_published_by is not null and p_published_by <> v_actor then raise exception 'Publisher identity mismatch'; end if;
  select * into v_tour from public.virtual_tours where id=p_tour_id for update;
  if v_tour.id is null then raise exception 'Tour not found'; end if;
  v_ready:=public.virtual_tour_publish_readiness(p_tour_id);
  if coalesce((v_ready->>'publishable')::boolean,false)=false then raise exception 'Tour is not ready to publish'; end if;
  v_version:=coalesce(v_tour.current_version,0)+1;
  v_token:=coalesce(v_tour.public_token,gen_random_uuid());
  v_snapshot:=jsonb_build_object(
    'tour',to_jsonb(v_tour),
    'scenes',(select coalesce(jsonb_agg(to_jsonb(s) order by s.sort_order),'[]'::jsonb) from public.virtual_tour_scenes s where s.tour_id=p_tour_id),
    'connections',(select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order),'[]'::jsonb) from public.virtual_tour_connections c where c.tour_id=p_tour_id and c.is_enabled),
    'hotspots',(select coalesce(jsonb_agg(to_jsonb(h) order by h.sort_order),'[]'::jsonb) from public.virtual_tour_hotspots h where h.tour_id=p_tour_id and h.is_enabled)
  );
  insert into public.virtual_tour_versions(tour_id,version_number,snapshot,status,created_by)
  values(p_tour_id,v_version,v_snapshot,'published',v_actor);
  insert into public.virtual_tour_publications(tour_id,residence_id,version_number,public_token,snapshot,status,published_by,valid_until)
  values(p_tour_id,v_tour.residence_id,v_version,v_token,v_snapshot,'published',v_actor,now()+interval '12 months');
  update public.virtual_tours set status='published',public_token=v_token,current_version=v_version,published_at=now(),updated_at=now() where id=p_tour_id;
  return jsonb_build_object('tour_id',p_tour_id,'public_token',v_token,'version_number',v_version,'published_at',now(),'published_by',v_actor);
end$$;

revoke all on function public.virtual_tour_publish_snapshot(uuid,uuid) from public,anon;
grant execute on function public.virtual_tour_publish_snapshot(uuid,uuid) to authenticated;
