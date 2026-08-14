-- Integração com bancos reais via Open Finance (Pluggy)
-- Conexões ficam em bank_connections; accounts/transactions passam a poder
-- ser preenchidas automaticamente (source = 'pluggy'), além do fluxo manual/chat já existente.

create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pluggy_item_id text not null unique,
  institution_name text not null,
  institution_image_url text,
  status text not null default 'UPDATING',
  status_detail text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts
  add column if not exists pluggy_account_id text unique,
  add column if not exists bank_connection_id uuid references public.bank_connections(id) on delete set null,
  add column if not exists source text not null default 'manual';

alter table public.accounts
  drop constraint if exists accounts_source_check;
alter table public.accounts
  add constraint accounts_source_check check (source in ('manual','pluggy'));

alter table public.transactions
  add column if not exists pluggy_transaction_id text unique;

alter table public.transactions
  drop constraint if exists transactions_source_check;
alter table public.transactions
  add constraint transactions_source_check check (source in ('chat','manual','pluggy'));

create index if not exists idx_bank_connections_user on public.bank_connections (user_id);
create index if not exists idx_accounts_bank_connection on public.accounts (bank_connection_id);

alter table public.bank_connections enable row level security;

create policy "own bank_connections" on public.bank_connections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
