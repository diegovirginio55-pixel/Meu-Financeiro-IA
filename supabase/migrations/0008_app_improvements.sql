-- Suporte para várias melhorias: histórico de saldo por conta, regras de
-- categorização personalizadas, histórico de aportes em metas, "heartbeat"
-- do cron (pra avisar se ele parar de rodar) e conteúdo guardado no log de
-- notificações (pra virar uma central de notificações dentro do app).

-- 1) Histórico diário de saldo por conta (permite gráfico de evolução).
create table if not exists public.account_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  bank_connection_id uuid references public.bank_connections(id) on delete cascade,
  snapshot_date date not null,
  balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_account_balance_snapshots_unique
  on public.account_balance_snapshots (account_id, snapshot_date);

alter table public.account_balance_snapshots enable row level security;

drop policy if exists "own account_balance_snapshots" on public.account_balance_snapshots;
create policy "own account_balance_snapshots" on public.account_balance_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.account_balance_snapshots to service_role;

-- 2) Regras de categorização personalizadas ("se a descrição contém X, vira Y").
create table if not exists public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pattern text not null,
  category text not null,
  created_at timestamptz not null default now()
);

alter table public.category_rules enable row level security;

drop policy if exists "own category_rules" on public.category_rules;
create policy "own category_rules" on public.category_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.category_rules to service_role;

-- 3) Histórico de aportes em metas de economia.
create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  amount numeric(14,2) not null,
  created_at timestamptz not null default now()
);

alter table public.goal_contributions enable row level security;

drop policy if exists "own goal_contributions" on public.goal_contributions;
create policy "own goal_contributions" on public.goal_contributions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.goal_contributions to service_role;

-- 4) "Heartbeat" do cron de sincronização — grava a última vez que o cron
-- rodou de fato, pra dar pra avisar no app se ele parar (ex: GitHub Actions
-- desabilitado ou secret errado).
create table if not exists public.system_heartbeats (
  key text primary key,
  last_run_at timestamptz not null default now()
);

alter table public.system_heartbeats enable row level security;

drop policy if exists "read system_heartbeats" on public.system_heartbeats;
create policy "read system_heartbeats" on public.system_heartbeats
  for select using (true);

grant select, insert, update, delete on public.system_heartbeats to service_role;

-- 5) Guarda o conteúdo da notificação (não só o dedupe) pra virar uma
-- central de notificações dentro do app, além do push.
alter table public.notification_log add column if not exists title text;
alter table public.notification_log add column if not exists body text;
alter table public.notification_log add column if not exists url text;
alter table public.notification_log add column if not exists read_at timestamptz;
