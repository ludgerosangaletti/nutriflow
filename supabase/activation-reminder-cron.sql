-- Nome sugerido para esta consulta no SQL Editor:
-- Automação — ativação de conta presencial pelo WhatsApp
--
-- Executa diariamente às 08:30 de Brasília. O site seleciona somente pacientes
-- presenciais que autorizaram mensagens, receberam o convite há pelo menos 24h
-- e ainda não concluíram o cadastro. Há idempotência e limite de tentativas.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select cron.unschedule('lembrete-ativacao-presencial-8h30')
where exists (
  select 1
  from cron.job
  where jobname = 'lembrete-ativacao-presencial-8h30'
);

select cron.schedule(
  'lembrete-ativacao-presencial-8h30',
  '30 11 * * *',
  $$
  select net.http_post(
    url := 'https://ludgerosangaletti.com.br/api/cron/activation-reminders',
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
where jobname = 'lembrete-ativacao-presencial-8h30';
