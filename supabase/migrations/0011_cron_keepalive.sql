-- Cron confiável de dentro do Supabase (pg_cron + pg_net), a cada 5 minutos.
--
-- POR QUÊ: o agendamento do GitHub Actions ("a cada 10 min") na prática roda
-- a cada 3–8 HORAS (o GitHub atrasa cron de repositório). Sem tráfego, o
-- Render (plano free) dorme depois de 15 min e leva ~1 min pra acordar.
-- Quando a Pluggy manda o webhook de transação nova com o servidor dormindo,
-- ela desiste em 10 s e só reenvia 15 min (ou 2 h) depois — por isso as
-- notificações chegavam muito atrasadas. Chamando o app a cada 5 min, o
-- servidor fica acordado, o webhook é atendido na hora e o cron de alertas
-- roda no horário certo.
--
-- ANTES DE RODAR: guarde o segredo do cron (o MESMO valor de BANK_CRON_SECRET
-- do Render) no Vault do Supabase, uma única vez, no SQL Editor:
--
--   select vault.create_secret('COLE-AQUI-O-BANK_CRON_SECRET', 'bank_cron_secret');
--
-- (Para trocar depois: select vault.update_secret(id, 'novo-valor') usando o
-- id de vault.secrets where name = 'bank_cron_secret'.)
--
-- Se o endereço do app mudar, ajuste a URL abaixo e rode este arquivo de novo.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Remove a versão anterior do agendamento (se existir) e cria de novo.
select cron.unschedule(jobid) from cron.job where jobname = 'meu-financeiro-sync';

select cron.schedule(
  'meu-financeiro-sync',
  '*/5 * * * *',
  $job$
  select net.http_get(
    url := 'https://meu-financeiro-ia.onrender.com/api/bank/cron',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'bank_cron_secret' limit 1),
        ''
      )
    ),
    timeout_milliseconds := 30000
  );
  $job$
);

-- Limpeza: o pg_cron guarda o histórico de cada execução; mantém só 3 dias.
select cron.unschedule(jobid) from cron.job where jobname = 'meu-financeiro-cron-cleanup';

select cron.schedule(
  'meu-financeiro-cron-cleanup',
  '17 4 * * *',
  $job$
  delete from cron.job_run_details where end_time < now() - interval '3 days';
  $job$
);
