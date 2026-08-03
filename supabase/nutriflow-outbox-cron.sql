-- Execute once in the Supabase SQL Editor after configuring CHECKIN_REMINDER_SECRET.
-- The route is idempotent and processes the D1 Outbox through Domain Events.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select cron.unschedule('nutriflow-process-outbox')
where exists (select 1 from cron.job where jobname = 'nutriflow-process-outbox');

select cron.schedule(
  'nutriflow-process-outbox',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://ludgerosangaletti.com.br/api/cron/process-outbox',
    headers := jsonb_build_object(
      'x-checkin-reminder-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'checkin_reminder_secret'),
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
