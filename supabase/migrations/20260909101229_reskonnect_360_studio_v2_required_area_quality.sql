create or replace function public.virtual_tour_scene_quality_upsert(p_scene_id uuid,p_metrics jsonb,p_privacy_issues jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_score numeric; v_pass boolean; v_sharp numeric:=coalesce((p_metrics->>'sharpness')::numeric,0); v_light numeric:=coalesce((p_metrics->>'lighting')::numeric,0); v_cov numeric:=coalesce((p_metrics->>'coverage')::numeric,0); v_overlap numeric:=coalesce((p_metrics->>'overlap')::numeric,0); v_stability numeric:=coalesce((p_metrics->>'stability')::numeric,0); v_exposure numeric:=coalesce((p_metrics->>'exposure_consistency')::numeric,0);
begin
 if not exists(select 1 from public.virtual_tour_scenes s join public.virtual_tours t on t.id=s.tour_id where s.id=p_scene_id and public.virtual_tour_can_manage_residence(t.residence_id)) then raise exception 'Scene access denied'; end if;
 v_score:=round((v_sharp*.22+v_light*.14+v_cov*.22+v_overlap*.17+v_stability*.13+v_exposure*.12)::numeric,2);
 v_pass:=v_score>=82 and jsonb_array_length(coalesce(p_privacy_issues,'[]'::jsonb))=0;
 insert into public.virtual_tour_quality_reports(scene_id,score,sharpness,lighting,coverage,overlap,stability,exposure_consistency,privacy_issues,passed) values(p_scene_id,v_score,v_sharp,v_light,v_cov,v_overlap,v_stability,v_exposure,coalesce(p_privacy_issues,'[]'::jsonb),v_pass);
 update public.virtual_tour_scenes set quality_score=v_score,status=case when v_pass then 'ready' else 'review' end,updated_at=now() where id=p_scene_id;
 return jsonb_build_object('score',v_score,'passed',v_pass,'minimum',82,'gold_target',90,'privacy_clear',jsonb_array_length(coalesce(p_privacy_issues,'[]'::jsonb))=0);
end$$;
revoke all on function public.virtual_tour_scene_quality_upsert(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.virtual_tour_scene_quality_upsert(uuid,jsonb,jsonb) to authenticated;
