-- ResKonnect AdminOS Release Gate 3 production completion record.
-- Gate scope: Phase 6 WhatsApp Agent, Phase 7 Follow-Up Autopilot,
-- Phase 8 Company Documents & Paperwork. Phase 9+ remains out of scope.

update public.platform_settings
set value = jsonb_build_object(
  'release', 3,
  'total_phases', 11,
  'completed_phases', jsonb_build_array(0,1,2,3,4,5,6,7,8),
  'current_phase', 9,
  'last_completed_phase', 8,
  'next_phase', 9,
  'release_status', 'gate_complete',
  'release_gate_3', 'complete',
  'phase_0', 'complete',
  'phase_1', 'complete',
  'phase_2', 'complete',
  'phase_3', 'complete',
  'phase_4', 'complete',
  'phase_5', 'complete',
  'phase_6', 'complete',
  'phase_7', 'complete',
  'phase_8', 'complete',
  'phase_9', 'not_started',
  'phase_10', 'not_started',
  'gate_closed_at', now()
),
    description = 'ResKonnect AdminOS implementation progress. Release Gate 3 passed in production; phases 0-8 are complete. Phase 9+ remains excluded.',
    updated_at = now()
where key = 'adminos_release_progress';

insert into public.adminos_audit_events(
  actor_type,
  action,
  entity_type,
  after_state,
  metadata
)
values (
  'system',
  'release_gate_3.passed',
  'adminos_release',
  jsonb_build_object(
    'release', 3,
    'completed_phases', jsonb_build_array(0,1,2,3,4,5,6,7,8),
    'next_phase', 9
  ),
  jsonb_build_object(
    'production_commit', '4eea758f1ca717236cd0984eb4299bd9fa68020a',
    'vercel_deployment', 'dpl_JBdUaujCXCa2Dz7Y5CZxU4BCePLN',
    'vercel_state', 'READY',
    'source', 'release_gate_3_production_validation'
  )
);