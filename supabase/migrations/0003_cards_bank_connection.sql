-- Cartões de crédito também podem vir de uma conexão bancária (Pluggy),
-- mesma lógica já aplicada em accounts na migration anterior.

alter table public.cards
  add column if not exists pluggy_account_id text unique,
  add column if not exists bank_connection_id uuid references public.bank_connections(id) on delete set null,
  add column if not exists source text not null default 'manual';

alter table public.cards
  drop constraint if exists cards_source_check;
alter table public.cards
  add constraint cards_source_check check (source in ('manual','pluggy'));

create index if not exists idx_cards_bank_connection on public.cards (bank_connection_id);
