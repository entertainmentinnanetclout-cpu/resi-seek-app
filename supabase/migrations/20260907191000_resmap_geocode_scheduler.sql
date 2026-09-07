insert into public.adminos_scheduler_secrets(secret_key,secret_value)
values('resmap_geocode_worker',encode(gen_random_bytes(32),'hex'))
on conflict(secret_key) do nothing;

do $$ begin
  if exists(select 1 from cron.job where jobname='resmap-geocode-worker') then
    perform cron.unschedule((select jobid from cron.job where jobname='resmap-geocode-worker' limit 1));
  end if;
end $$;

select cron.schedule(
  'resmap-geocode-worker',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/resmap-geocode-worker',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-resmap-cron-token',(select secret_value from public.adminos_scheduler_secrets where secret_key='resmap_geocode_worker')
      ),
      body := '{"action":"tick"}'::jsonb
    );
  $job$
);
