# ResKonnect production Auth & Database resilience incident

## Grounded findings
- External project `mefjzkhobkltlbmhusdh`, Supabase Auth repeatedly returned 500/504, and SQL editor reads intermittently timed out.
- 31 active database cron jobs; five every-minute jobs consistently returned `job startup timeout` after repeated attempts.
- `cron.job_run_details` occupies ~516 MB of a ~1.1 GB database, with >535k generated run IDs. History has only a `runid` PK index; Supabase documentation says history is not purged automatically.
- The `auth.users` UPDATE trigger included `last_sign_in_at`, causing every password sign-in to synchronously update `public.profiles` and query `user_roles`.
- The existing `identity-sync` Edge Function already handles profile `last_login_at` asynchronously after sign-in. Keep this function and its access checking.
- A DB snapshot had ~18–21 connections (max 60), so exhaustion of connection slots is **not proven**. PostgreSQL CPU/RAM/swap/disk I/O still need external observability to identify the bottleneck precisely.

## Implemented in production
Five existing cron jobs rescheduled and staggered; their scheduled starts reduce from 300/h to about 84/h. They remain enabled. Check the separate SQL migration for idempotent parity and individual rollback. Core room-hold expiry, authorization and payment functions are untouched.

## Application release
- Delay nonessential identity-sync by 8 seconds until the server-verified access context succeeds, rather than competing with sign-in and access resolution.
- Distinguish Auth 500/502/503/504 from the user's internet being offline.
- Jitter permission check retries so all users do not immediately retry at the same moment. Do not automatically retry password POST requests.
- Keep previous session fail-closed if access cannot be verified, rather than treating outage as a change in identity.
- Rebuild and run web/Android auth regression suite.

## Auth trigger migration
The narrow migration removing `last_sign_in_at` from the synchronous trigger was **applied and verified on external Supabase** using `auth_identity_trigger_fast_path_20261110`. The resulting `auth.users` trigger continues covering email/confirmation and metadata edits; the existing deferred `identity-sync` function records last login after verified access.

## Safety / scope and unresolved
- A zero-downtime guarantee is impossible. Do not accept expired tokens, bypass RLS, copy session JWTs to another auth provider, or turn off password verification.
- Cron history cleanup (e.g. bounded deletion of old finalized entries after approved retention/backups) is recommended but **not automatically performed**. Avoid `VACUUM FULL` on production.
- Check Supabase Dashboard Database Reports for resource pressure, compute size and storage. If still unhealthy, escalate to Supabase Support with sanitized request IDs and consider an approved compute upgrade. Do not silently incur new recurring costs.
- Verify real sign-ins with an authorized test account after backend connectivity is stable.
- Keep issue #191 open until Auth HTTP 500/504 volume normalizes and repeated real sign-in/refresh tests succeed.
