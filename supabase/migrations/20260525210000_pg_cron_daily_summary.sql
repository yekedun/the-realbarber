-- pg_cron ve pg_net extension'larını etkinleştir (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Her sabah 05:00 UTC (08:00 Türkiye saati) daily-summary-push çalıştır
-- app.supabase_url ve app.service_role_key için Supabase SQL Editor'da bir kez çalıştır:
--   ALTER DATABASE postgres SET app.supabase_url = 'https://hnaxcntnntwvqhremzet.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<SERVICE_ROLE_KEY>';

SELECT cron.schedule(
  'daily-summary-push',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url        := current_setting('app.supabase_url') || '/functions/v1/daily-summary-push',
    headers    := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body       := '{}'::jsonb
  ) AS request_id;
  $$
);
