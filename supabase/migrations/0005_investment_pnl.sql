-- Lucro de investimentos: posição, snapshots diários e movimentações da Pluggy

alter table public.investments
  add column if not exists amount_profit numeric(14,2),
  add column if not exists amount_original numeric(14,2),
  add column if not exists last_month_rate numeric(10,4);

create table if not exists public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  investment_id uuid references public.investments(id) on delete cascade,
  bank_connection_id uuid references public.bank_connections(id) on delete set null,
  pluggy_transaction_id text unique,
  type text not null,
  amount numeric(14,2) not null default 0,
  date date not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.investment_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  investment_id uuid not null references public.investments(id) on delete cascade,
  bank_connection_id uuid references public.bank_connections(id) on delete set null,
  snapshot_date date not null,
  amount numeric(14,2) not null,
  amount_profit numeric(14,2),
  unique (investment_id, snapshot_date)
);

create index if not exists idx_investment_transactions_date on public.investment_transactions (user_id, date);
create index if not exists idx_investment_snapshots_date on public.investment_snapshots (user_id, snapshot_date);

alter table public.investment_transactions enable row level security;
alter table public.investment_snapshots enable row level security;

drop policy if exists "own investment_transactions" on public.investment_transactions;
create policy "own investment_transactions" on public.investment_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own investment_snapshots" on public.investment_snapshots;
create policy "own investment_snapshots" on public.investment_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.investment_transactions to anon, authenticated, service_role;
grant select, insert, update, delete on public.investment_snapshots to anon, authenticated, service_role;
