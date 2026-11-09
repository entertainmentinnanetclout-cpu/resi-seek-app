-- Production parity for the ResKonnect incident mitigation applied
-- using cron.alter_job on external Supabase mefjzkhobkltlbmhusdh.
-- Reschedule existing jobs only; never remove jobs or change commands.
-- No reservation hold, payment or application service jobs are altered.
DO $$
DECLARE
  item record;
  job record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('adminos-whatsapp-event-worker', '*/2 * * * *'),
    ('adminos-service-recovery-watch', '1-59/2 * * * *'),
    ('adminos-escalation-alert-worker', '1-59/5 * * * *'),
    ('adminos-whatsapp-media-archive', '3-59/10 * * * *'),
    ('resmap-geocode-worker', '4-59/10 * * * *')
  ) AS v(name, new_schedule) LOOP
    SELECT jobid,schedule,username,active INTO job FROM cron.job WHERE jobname=item.name;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Expected cron job % not found', item.name;
    END IF;
    IF job.username <> 'postgres' OR NOT job.active THEN
      RAISE EXCEPTION 'Unexpected owner or disabled job: %', item.name;
    END IF;
    IF job.schedule=item.new_schedule THEN CONTINUE; END IF;
    IF job.schedule <> '* * * * *' THEN
      RAISE EXCEPTION 'Unexpected cron schedule for %, manual review', item.name;
    END IF;
    PERFORM cron.alter_job(job_id:=job.jobid,schedule:=item.new_schedule);
  END LOOP;
END $$;

-- Reversal if independently justified:
-- select cron.alter_job(job_id := (select jobid from cron.job where jobname =
-- 'resmap-geocode-worker'), schedule := '* * * * *');
-- Repeat only for the specifically approved job(s).
