-- Processing state is writable only by an authenticated residence manager or God Mode through RLS/RPC.
drop policy if exists virtual_tour_processing_manage on public.virtual_tour_processing_jobs;
create policy virtual_tour_processing_manage on public.virtual_tour_processing_jobs for all to authenticated
using (exists(select 1 from public.virtual_tours t where t.id=virtual_tour_processing_jobs.tour_id and public.virtual_tour_can_manage_residence(t.residence_id)))
with check (exists(select 1 from public.virtual_tours t where t.id=virtual_tour_processing_jobs.tour_id and public.virtual_tour_can_manage_residence(t.residence_id)));

drop policy if exists virtual_tour_quality_manage on public.virtual_tour_quality_reports;
create policy virtual_tour_quality_manage on public.virtual_tour_quality_reports for all to authenticated
using (exists(select 1 from public.virtual_tour_scenes s join public.virtual_tours t on t.id=s.tour_id where s.id=virtual_tour_quality_reports.scene_id and public.virtual_tour_can_manage_residence(t.residence_id)))
with check (exists(select 1 from public.virtual_tour_scenes s join public.virtual_tours t on t.id=s.tour_id where s.id=virtual_tour_quality_reports.scene_id and public.virtual_tour_can_manage_residence(t.residence_id)));
