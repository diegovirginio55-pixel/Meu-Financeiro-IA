-- Posição de investimentos importada da Pluggy (Meu Pluggy / Open Finance)

alter table public.investments
  add column if not exists pluggy_investment_id text unique,
  add column if not exists bank_connection_id uuid references public.bank_connections(id) on delete set null,
  add column if not exists source text not null default 'manual';

alter table public.investments
  drop constraint if exists investments_source_check;
alter table public.investments
  add constraint investments_source_check check (source in ('manual','pluggy'));

create index if not exists idx_investments_bank_connection on public.investments (bank_connection_id);
