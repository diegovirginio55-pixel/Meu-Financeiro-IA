-- Integridade do sync, notificações mais rápidas e ajustes atômicos de saldo.
-- Pode ser executada mais de uma vez sem problema (tudo é "if not exists" /
-- "create or replace"). O app continua funcionando antes desta migration,
-- mas só com ela as melhorias abaixo passam a valer.

-- 1) Edições feitas pelo usuário em lançamentos importados do banco não são
-- mais desfeitas pelo próximo sync.
alter table public.transactions
  add column if not exists user_edited boolean not null default false;

-- 2) Lançamentos do banco que o usuário excluiu não voltam no próximo sync.
create table if not exists public.deleted_pluggy_transactions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pluggy_transaction_id text not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, pluggy_transaction_id)
);

alter table public.deleted_pluggy_transactions enable row level security;

drop policy if exists "own deleted_pluggy_transactions" on public.deleted_pluggy_transactions;
create policy "own deleted_pluggy_transactions" on public.deleted_pluggy_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.deleted_pluggy_transactions to authenticated, service_role;

-- 3) Sync: quando foi o último pedido de atualização ao banco (separado do
-- último "puxar dados") e uma trava para dois syncs da mesma conexão não
-- rodarem ao mesmo tempo (webhooks quase simultâneos duplicavam push).
alter table public.bank_connections
  add column if not exists last_triggered_at timestamptz,
  add column if not exists sync_lock_until timestamptz,
  add column if not exists sync_pending boolean not null default false;

-- 4) Cota diária do chat guardada no banco (antes ficava só num cookie, que
-- zerava ao limpar o navegador ou usar outra aba/aparelho).
create table if not exists public.chat_usage (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_key text not null,
  used integer not null default 0,
  lock_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, period_key)
);

alter table public.chat_usage enable row level security;

drop policy if exists "own chat_usage" on public.chat_usage;
create policy "own chat_usage" on public.chat_usage
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.chat_usage to authenticated, service_role;

-- 5) Ajuste atômico de saldo/fatura (saldo = saldo + delta numa única
-- instrução). Evita perder atualização quando o sync e uma edição mexem no
-- mesmo saldo ao mesmo tempo. "security invoker": a RLS do usuário vale.
create or replace function public.adjust_account_balance(p_account_id uuid, p_delta numeric)
returns numeric
language sql
security invoker
set search_path = public
as $$
  update public.accounts
     set balance = balance + p_delta,
         updated_at = now()
   where id = p_account_id
  returning balance;
$$;

create or replace function public.adjust_card_invoice(p_card_id uuid, p_delta numeric)
returns numeric
language sql
security invoker
set search_path = public
as $$
  update public.cards
     set current_invoice = greatest(0, current_invoice + p_delta),
         updated_at = now()
   where id = p_card_id
  returning current_invoice;
$$;

grant execute on function public.adjust_account_balance(uuid, numeric) to authenticated, service_role;
grant execute on function public.adjust_card_invoice(uuid, numeric) to authenticated, service_role;

-- 6) Permissões explícitas para o usuário logado nas tabelas criadas nas
-- migrations 0007-0009 (antes só service_role tinha grant explícito; o app
-- dependia do grant padrão do Supabase, que pode não existir em projeto novo).
grant select, insert, update, delete on public.notification_log to authenticated;
grant select, insert, update, delete on public.account_balance_snapshots to authenticated;
grant select, insert, update, delete on public.category_rules to authenticated;
grant select, insert, update, delete on public.goal_contributions to authenticated;
grant select on public.system_heartbeats to authenticated;
grant select, insert, update, delete on public.monthly_budgets to authenticated;

-- 7) Índices usados pelo sync e pelas telas de histórico.
create index if not exists idx_transactions_user_date on public.transactions (user_id, date desc);
create index if not exists idx_transactions_account_date on public.transactions (account_id, date);
create index if not exists idx_transactions_card_date on public.transactions (card_id, date);

-- 8) Heartbeat do cron passa a guardar o resultado (pra saber se o sync
-- está falhando, não só se o cron rodou).
alter table public.system_heartbeats
  add column if not exists last_ok_at timestamptz,
  add column if not exists last_error text;
