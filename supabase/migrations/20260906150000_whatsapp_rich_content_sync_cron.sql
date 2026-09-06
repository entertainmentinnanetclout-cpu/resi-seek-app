do $$ begin
  if exists(select 1 from cron.job where jobname='adminos-whatsapp-rich-content-sync') then
    perform cron.unschedule('adminos-whatsapp-rich-content-sync');
  end if;
end $$;

select cron.schedule(
  'adminos-whatsapp-rich-content-sync',
  '7 * * * *',
  $job$
    select net.http_post(
      url := 'https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/adminos-whatsapp-rich-bootstrap',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-adminos-cron-token',(select secret_value from public.adminos_scheduler_secrets where secret_key='whatsapp_event_worker')
      ),
      body := '{"action":"sync"}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);