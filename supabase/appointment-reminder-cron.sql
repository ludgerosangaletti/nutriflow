-- Nome sugerido para esta consulta no SQL Editor:
-- Automação — lembretes de retorno presencial
--
-- Execute depois de publicar a função appointment-reminder-email.
-- A rotina usa o segredo já existente no Vault e roda diariamente às 08:20
-- de Brasília. O site evita duplicidade por paciente e data da consulta.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select cron.unschedule('lembretes-retorno-presencial-8h20')
where exists (
  select 1
  from cron.job
  where jobname = 'lembretes-retorno-presencial-8h20'
);

select cron.schedule(
  'lembretes-retorno-presencial-8h20',
  '20 11 * * *',
  $$
  select net.http_post(
    url := 'https://ludgerosangaletti.com.br/api/cron/appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-checkin-reminder-secret',
      (select decrypted_secret
       from vault.decrypted_secrets
       where name = 'checkin_reminder_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

select jobid, jobname, schedule, active
from cron.job
where jobname = 'lembretes-retorno-presencial-8h20';
