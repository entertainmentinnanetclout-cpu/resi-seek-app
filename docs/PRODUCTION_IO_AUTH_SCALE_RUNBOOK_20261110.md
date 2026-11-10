# ResKonnect P0: disk I/O and Auth database write-pressure response — 2026-11-10

## Direct evidence
- Micro compute, database ~1,136 MB, cron.job_run_details ~517 MB, staff_tasks ~222 MB.
- 219,130 staff_tasks records linked to occupancy intelligence but only 723 distinct occupancy source IDs. ~219,015 were already completed. The old RG8 refresh unconditionally closed and recreated tasks each run, even if the occupancy state was unchanged.
- 102,960 prospect.updated events were queued; the prospect event trigger generated events on UPDATE of stage/score/priority even when the values were unchanged.
- pg_stat_statements (cumulative, not live allocation): adminos_refresh_next_best_actions 17.1 GB WAL, adminos_generate_proactive_notifications 15.6 GB, adminos_rg7_application_operations_cycle 8.7 GB, adminos_refresh_service_recovery 6.3 GB and other reporting cycles. These totals are since statistics capture/reset, not a per-day measurement.
- Direct server status ACTIVE_HEALTHY during this sampling window with 34 of max 60 connections. Database health alone does not prove successful Google OAuth.

## Deployed safeguards
- Stable occupancy snapshots are not rewritten if the material occupancy data is unchanged.
- Only tasks for resolved/changed occupancy conditions are completed, rather than every active task on each run.
- One repeatable exception task per residence/year/status within a 30-day window; recurring tasks can be generated after the cooldown if the exception persists. Concurrent refreshes are guarded by an advisory transaction lock.
- Prospect.updated is not emitted if stage, score and priority are unchanged.
- Noncritical batch jobs have reduced cadences; live/Auth, WhatsApp event ingestion and both room-hold expiry jobs remain enabled. The trade-off is 30-120 minutes of background intelligence freshness delay.
- Full SQL is captured as a reviewed migration. A dedicated release test gates the build.

## Deferred, approval-dependent housekeeping
- Cron job history is **not** cleaned automatically by Supabase and should have a bounded retention policy (e.g. 30-45 days after verifying policy and recent backup restoration).
- Do not DELETE 331k old cron rows in one transaction or run VACUUM FULL on live Micro. After retention approval, prune small batches off-peak and allow normal autovacuum, monitoring WAL, I/O and auth 5xx; stop if pressure rises.
- Historical completed occupancy tasks remain intact pending an approved 90-day archive/retention plan; duplicate prevention stops further unbounded growth first.
- Review existing SMTP 553 domain rejection and Google callback config independently.

## One-million-user architecture (capacity target, not present-day claim)
1. Define whether 1M means registered accounts, monthly active accounts, or concurrent sessions; capacity requirements differ orders of magnitude. Use staging and realistic k6 load tests (OAuth, search, application writes, landlord ops) before any size decision.
2. Establish an SLO and alerts (e.g. Auth success >99.9%, 5xx <0.1% with 5min alert, disk I/O budget <20% for 15min, CPU/RAM, p95 latency, connection headroom and WAL bytes/min); choose alert thresholds based on real baseline.
3. Separate the critical Auth/user permissions and reservation writes from nonessential AI/SI background cycles. Use queues and workers with concurrency limits, idempotency and dead-letter queues. Avoid full-table rescans and no-op updates on a timer.
4. Put immutable media on a CDN/object storage; cache public city aggregates and property results (while preserving access checks and truthful availability). Throttle costly polling and high-cardinality realtime subscriptions.
5. Use indexes on actual filtered join paths, partition large event histories by date, batch purge/archival with approved retention, and monitor PostgreSQL WAL/I/O and slow queries.
6. Scale Supabase compute from Micro only when observability warrants it. Micro baseline 11 MB/s / 500 IOPS and 60 max connections. Larger tiers have higher sustained resources; 4XL and above have consistent disk baseline without burst dependency; even they need load tests. All paid changes require user approval.
7. Adopt staged releases, production canary credentials in secrets (not chat), external /auth health + REST+OAuth transaction probes, weekly restore drills, documented RTO/RPO, incident runbooks and incident-retrospective reviews.
8. Plan multi-region read-only availability and disaster-recovery with Supabase-managed backups and replica policies once product footprint warrants it. Do not assume a database replica is automatically a zero-downtime Auth failover.

## Verification
- Apply to the specified external project, read back function bodies and Cron schedules.
- Confirm counts of occupancy-related tasks stop increasing at the previous ~4k/day pace after cron cycles. Historical records are expected to remain.
- Check prospect.updated queue growth and 5xx error rates; isolate email/password, returning Google OAuth, first-time Google OAuth, refresh and recovery.
- Keep issue #191 OPEN until real-user login and independent provider metrics are stable. No zero-outage guarantees.
