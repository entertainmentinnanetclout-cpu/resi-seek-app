# SEC-05 / SEC-21: Application-health RPC access boundary
**15 November 2026 — ResKonnect Supabase project `mefjzkhobkltlbmhusdh`**

## Concrete authorization defect
The public `SECURITY DEFINER` function `adminos_recalculate_application_health(p_application_id uuid)` previously granted direct `EXECUTE` to `authenticated` users with no caller, ownership or MFA check. It reads a selected application's private profile/document state, computes and writes an internal `adminos_application_health_scores` record, and returns the record. An authenticated actor could invoke the function with another application's identifier, bypassing the intended internal access controls.

**Safely observed:** a rolled-back SQL session as a simulated ordinary `authenticated` user successfully called the function with a nonexistent UUID and received a null result. This demonstrates a real missing permission barrier, *not* successful cross-student record access or unauthorized data extraction.

## Legitimate callers independently identified
- `public.adminos_application_health_application_trigger()` — function owner `postgres`, SECURITY DEFINER.
- `public.adminos_application_health_document_trigger()` — owner `postgres`, SECURITY DEFINER.
- `public.adminos_application_health_profile_trigger()` — owner `postgres`, SECURITY DEFINER.
- `public.adminos_rg7_application_operations_cycle()` — service-role-only `EXECUTE`, SECURITY DEFINER, owner `postgres`.
- GitHub application source does not directly call `.rpc("adminos_recalculate_application_health")`; the data refreshes through DB triggers and the controlled operations cycle.

This justifies removing direct invocation rights rather than changing trigger logic or forcing staff MFA into a trigger that executes during user updates.

## Production correction
`supabase/migrations/20261115110500_sec05_internal_health_recalculation_rpc.sql` revokes routine-level `EXECUTE` from `PUBLIC`, `anon` and `authenticated`; retains explicit `service_role` EXECUTE. The function owner `postgres` naturally retains owner rights, so SECURITY DEFINER triggers continue to invoke it. No profile rows, application documents, reservations, service events, function definitions or RLS policy bodies were modified.

## Negative and compatibility checks
- Live SQL `has_function_privilege` must return `anon=false`, `authenticated=false`, `service_role=true`; `postgres` owner retains execution.
- An ordinary role must receive `42501` for a direct invocation with a fake UUID. A rolled-back service-role invocation with the same nonexistent UUID should return null.
- Ensure the four identified caller functions retain owner/role behavior and existing trigger bindings.
- `scripts/backend-live-contracts.snapshot.json` tracks the new `authenticated=false` grant and `scripts/sec04-sec05-internal-rpc.test.mjs` verifies its source migration.
- Run seven GitHub release workflows prior to merge.
- Rollback is to restore direct `authenticated` EXECUTE only after a reviewed compatibility exception; never make this callable by `anon` or `PUBLIC` without a secure ownership check.

This is a scoped privileged-RPC fix. Other Advisor warnings still require individual inspection; blanket revocation remains unsafe.
