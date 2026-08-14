-- Financeiro IA - schema inicial
-- Projeto pessoal de 1 usuário. Cada tabela guarda user_id e usa RLS
-- para garantir que cada linha só é visível/editável pelo próprio dono.

create extension if not exists "pgcrypto";

-- ==========================================================
-- Tabelas
-- ==========================================================

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'corrente', -- corrente | poupanca | dinheiro
  balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  credit_limit numeric(14,2),
  closing_day smallint,
  due_day smallint,
  current_invoice numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null,
  type text not null check (type in ('entrada','saida')),
  category text not null default 'Outros',
  date date not null default current_date,
  account_id uuid references public.accounts(id) on delete set null,
  card_id uuid references public.cards(id) on delete set null,
  source text not null default 'chat', -- chat | manual
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null,
  type text not null check (type in ('entrada','saida')),
  category text not null default 'Outros',
  day_of_month smallint not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null,
  person text,
  due_date date,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null,
  current_amount numeric(14,2) not null default 0,
  deadline date,
  created_at timestamptz not null default now()
);

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null,
  type text,
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

-- ==========================================================
-- Índices
-- ==========================================================

create index if not exists idx_transactions_user_date on public.transactions (user_id, date desc);
create index if not exists idx_transactions_user_category on public.transactions (user_id, category);
create index if not exists idx_chat_messages_user_created on public.chat_messages (user_id, created_at);

-- ==========================================================
-- Row Level Security
-- ==========================================================

alter table public.accounts enable row level security;
alter table public.cards enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring_items enable row level security;
alter table public.debts enable row level security;
alter table public.goals enable row level security;
alter table public.investments enable row level security;
alter table public.chat_messages enable row level security;

create policy "own accounts" on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own cards" on public.cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recurring_items" on public.recurring_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own debts" on public.debts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own goals" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own investments" on public.investments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own chat_messages" on public.chat_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==========================================================
-- Seed automático: quando o usuário é criado, já cria uma
-- conta e um cartão padrão para ele começar a usar de imediato.
-- ==========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.accounts (user_id, name, type, balance)
  values (new.id, 'Conta Principal', 'corrente', 0);

  insert into public.cards (user_id, name, current_invoice)
  values (new.id, 'Cartão Principal', 0);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
