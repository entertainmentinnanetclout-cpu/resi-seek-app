-- AdminOS Release Gate 2 production sign-off.
insert into public.platform_settings(key,value,description,updated_at)
values('adminos_release_progress',jsonb_build_object(
  'release',2,
  'total_phases',11,
  'completed_phases',jsonb_build_array(0,1,2,3,4,5),
  'current_phase',5,
  'release_status','complete',
  'release_gate_2','passed',
  'production_commit','4c8e272b9ee7b534946c5ec49c2871412b4c40a6',
  'phase_0','complete','phase_1','complete','phase_2','complete',
  'phase_3','complete','phase_4','complete','phase_5','complete','phase_6','not_started'
),'ResKonnect AdminOS implementation progress after Release Gate 2 production validation.',now())
on conflict(key) do update set value=excluded.value,description=excluded.description,updated_at=now();

insert into public.adminos_audit_events(actor_type,action,entity_type,after_state,metadata)
values('system','release_gate_2.passed','adminos_release',jsonb_build_object('release',2,'completed_phases',jsonb_build_array(0,1,2,3,4,5)),jsonb_build_object('production_commit','4c8e272b9ee7b534946c5ec49c2871412b4c40a6','vercel_state','READY'));
