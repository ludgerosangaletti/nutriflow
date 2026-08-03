-- Execute once in the Supabase SQL Editor after configuring CHECKIN_REMINDER_SECRET.
-- The route is idempotent and processes the D1 Outbox through Domain Events.
select cron.schedule(
  'nutriflow-process-outbox',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://ludgerosangaletti.com.br/api/cron/process-outbox',
    headers := jsonb_build_object(
      'x-checkin-reminder-secret', current_setting('app.settings.checkin_reminder_secret', true),
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
