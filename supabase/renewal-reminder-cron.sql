-- Execute no Supabase SQL Editor depois de publicar a função
-- renewal-reminder-email.
--
-- A automação reutiliza o segredo já cadastrado como
-- checkin_reminder_secret no Vault e roda diariamente às 08:10 de Brasília.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select cron.unschedule('lembretes-renovacao-diarios-8h10')
where exists (
  select 1 from cron.job where jobname = 'lembretes-renovacao-diarios-8h10'
);

select cron.schedule(
  'lembretes-renovacao-diarios-8h10',
  '10 11 * * *',
  $$
  select net.http_post(
    url := 'https://ludgerosangaletti.com.br/api/cron/renewal-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-checkin-reminder-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'checkin_reminder_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

select
  jobid,
  jobname,
  schedule,
  active
from cron.job
where jobname = 'lembretes-renovacao-diarios-8h10';
