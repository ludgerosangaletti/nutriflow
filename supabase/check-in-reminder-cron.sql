-- Execute no Supabase SQL Editor depois de publicar a função
-- check-in-reminder-email e cadastrar o segredo CHECKIN_REMINDER_SECRET.
--
-- 11:00 UTC corresponde a 08:00 no horário de Brasília.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select cron.unschedule('check-in-semanal-segunda-8h')
where exists (
  select 1 from cron.job where jobname = 'check-in-semanal-segunda-8h'
);

select cron.schedule(
  'check-in-semanal-segunda-8h',
  '0 11 * * 1',
  $$
  select net.http_post(
    url := 'https://ludgerosangaletti.com.br/api/cron/check-in-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-checkin-reminder-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'checkin_reminder_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
