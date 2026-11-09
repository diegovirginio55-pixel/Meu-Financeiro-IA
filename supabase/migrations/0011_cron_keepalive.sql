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
-- Não precisa configurar nada: o token que autoriza a chamada é gerado aqui
-- e fica numa tabela que só o servidor (service role) consegue ler.
-- Pode ser executada mais de uma vez. Se o endereço do app mudar, ajuste a
-- URL abaixo e rode de novo.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Configurações internas: RLS ligada e SEM políticas = o navegador (anon /
-- authenticated) não lê nada; só o servidor (service_role) e o próprio banco.
create table if not exists public.internal_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.internal_settings enable row level security;
revoke all on public.internal_settings from anon, authenticated;
grant select, insert, update, delete on public.internal_settings to service_role;

insert into public.internal_settings (key, value)
values ('cron_token', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

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
      'Bearer ' || coalesce((select value from public.internal_settings where key = 'cron_token'), '')
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
