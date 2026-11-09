-- Production load-shedding plan for cron job starts, based on 31 observed
-- active jobs and Supabase recommendation to keep concurrency <=8.
-- This migration is safe to retry after ambiguous connection timeouts:
-- each existing schedule must equal its known prior or intended value.
-- Preserves job command, owner, activation and frequency; only the phase
-- (minute within the hour) changes. Never touches booking hold expiry.
DO $$
DECLARE item record; job record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('adminos-rg14-reliability', '*/10 * * * *', '5-59/10 * * * *'),
    ('adminos-rg6-conversion-intelligence', '*/10 * * * *', '7-59/10 * * * *'),
    ('adminos-followup-autopilot', '*/15 * * * *', '8-59/15 * * * *'),
    ('adminos-rg11-reputation', '*/15 * * * *', '9-59/15 * * * *'),
    ('adminos-rg15-executive-operating-cycle', '*/15 * * * *', '10-59/15 * * * *'),
    ('adminos-rg7-application-operations', '*/15 * * * *', '11-59/15 * * * *'),
    ('adminos-service-metrics-refresh', '*/15 * * * *', '12-59/15 * * * *'),
    ('luna-demand-cycle', '*/15 * * * *', '13-59/15 * * * *'),
    ('adminos-rg9-student-opportunities', '*/20 * * * *', '14-59/20 * * * *'),
    ('adminos-rg10-partnerships', '*/30 * * * *', '16-59/30 * * * *'),
    ('adminos-rg12-seo-aeo-growth', '*/30 * * * *', '17-59/30 * * * *'),
    ('adminos-rg13-finance-admin', '*/30 * * * *', '18-59/30 * * * *'),
    ('adminos-rg8-occupancy-intelligence', '*/30 * * * *', '19-59/30 * * * *'),
    ('adminos-next-best-action-refresh', '*/5 * * * *', '1-59/5 * * * *'),
    ('adminos-proactive-whatsapp', '*/5 * * * *', '2-59/5 * * * *'),
    ('adminos-rg12-indexnow-worker', '*/5 * * * *', '3-59/5 * * * *'),
    ('dimpho-intelligence-cycle', '*/5 * * * *', '4-59/5 * * * *')
  ) AS v(name, old_schedule, new_schedule) LOOP
    SELECT jobid, schedule, username, active INTO job
    FROM cron.job WHERE jobname = item.name;
    IF NOT FOUND OR job.username <> 'postgres' OR NOT job.active THEN
      RAISE EXCEPTION 'Unexpected cron job status/owner: %', item.name;
    END IF;
    IF job.schedule = item.new_schedule THEN CONTINUE; END IF;
    IF job.schedule <> item.old_schedule THEN
      RAISE EXCEPTION 'Unexpected cron schedule for %: %', item.name, job.schedule;
    END IF;
    PERFORM cron.alter_job(job_id := job.jobid, schedule := item.new_schedule);
  END LOOP;
END $$;
