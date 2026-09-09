-- Source parity for production 360 Studio V2 admin access hardening.
-- Direct table access remains RLS-governed; God Mode receives only authenticated access.

grant select, insert, update, delete on public.virtual_tours to authenticated;
grant select, insert, update, delete on public.virtual_tour_scenes to authenticated;
grant select, insert, update, delete on public.virtual_tour_scene_assets to authenticated;
grant select, insert, update, delete on public.virtual_tour_capture_sessions to authenticated;
grant select, insert, update, delete on public.virtual_tour_capture_frames to authenticated;
grant select, insert, update, delete on public.virtual_tour_processing_jobs to authenticated;
grant select, insert, update, delete on public.virtual_tour_quality_reports to authenticated;
grant select, insert, update, delete on public.virtual_tour_connections to authenticated;
grant select, insert, update, delete on public.virtual_tour_hotspots to authenticated;
grant select on public.virtual_tour_versions to authenticated;
grant select on public.virtual_tour_publications to authenticated;
grant select, insert on public.virtual_tour_analytics to authenticated;
grant select, insert, update, delete on public.virtual_tour_entitlements to authenticated;
grant select on public.virtual_tour_release_registry to authenticated;
