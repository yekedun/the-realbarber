-- Fix current_setting calls to use missing_ok=true so pg_cron job doesn't throw
-- when app.supabase_url / app.service_role_key are not yet configured.
SELECT cron.unschedule('daily-summary-push');

SELECT cron.schedule(
  'daily-summary-push',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url        := current_setting('app.supabase_url', true) || '/functions/v1/daily-summary-push',
    headers    := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body       := '{}'::jsonb
  ) AS request_id;
  $$
);
