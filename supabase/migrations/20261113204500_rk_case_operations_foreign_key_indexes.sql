-- Follow-up to Postgres advisor: cover every new case-operation FK (audits never depend on sequential scans).
create index if not exists rk_case_collaboration_sender_idx on public.rk_case_collaboration(sender_id);
create index if not exists rk_case_tasks_assigned_by_idx on public.rk_case_tasks(assigned_by) where assigned_by is not null;
create index if not exists rk_case_tasks_completed_by_idx on public.rk_case_tasks(completed_by) where completed_by is not null;
create index if not exists rk_case_workflows_handover_by_idx on public.rk_case_workflows(handover_approved_by) where handover_approved_by is not null;
create index if not exists rk_case_workflows_updated_by_idx on public.rk_case_workflows(updated_by) where updated_by is not null;
