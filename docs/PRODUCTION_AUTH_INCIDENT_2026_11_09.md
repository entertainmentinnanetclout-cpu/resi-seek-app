# ResKonnect: production Auth failure incident — 2026-11-09

## Direct evidence

Project: `mefjzkhobkltlbmhusdh`. Vercel website deployment remained READY.
Supabase Auth logs from approximately 20:40–21:40 UTC showed repeated HTTP 500 and 504 responses:
- `request_timeout` and `unexpected_failure` in Auth.
- `failed to connect to host=localhost user=supabase_auth_admin database=postgres` during identity lookup.
- `context deadline exceeded`.
- PostgreSQL error state 57014 (query cancellation) and 08006 (connection failure).
- Supabase project control plane reported `ACTIVE_HEALTHY`, but several independent SQL operations timed out.
- One sampled Postgres session snapshot had 18 connections of a max 60, with no current lock waits, so do **not** assume a connection-limit breach is proven.

## Changes to reduce user impact

- Error-classify transient Auth API 500/502/503/504 separately from bad passwords, and show an actionable message.
- Never quietly classify a transient `getSession()` error as a signed-out user.
- Trust Supabase getSession/automatic token refresh on app focus instead of manually racing a second refresh.
- Preserve login forms, account records, passwords, prior sessions and server-enforced access rules.
- Integrate regression coverage in production build.

## Still required for incident closure

This hotfix **does not cure a PostgreSQL infrastructure failure**. Inspect Supabase Database Reports for CPU, RAM, swap, disk I/O, connection pool, and slow queries during the failing hours. Determine if infrastructure scaling is warranted before incurring cost. If intermittent 500/504 persists, file a Supabase Support case with anonymized request IDs, timestamps and error excerpts.

Do not reset passwords, bulk revoke sessions, delete accounts, blindly kill Postgres sessions, remove RLS or restart production without evidence and a recovery window. Never test login by accepting real user passwords in a support chat.

Validation: GitHub TypeScript + full build + web browser regression + Android CI, followed by a real-user sign-in test once Supabase Auth connectivity stabilizes. No real-user credential test performed.
