-- Lembretes de contas a pagar com botão "Já paguei" na notificação.
-- Guarda quais contas (recorrência, dívida ou fatura de cartão) já foram
-- pagas em cada vencimento, para o app parar de lembrar daquela conta.
-- Pode ser executada mais de uma vez.

create table if not exists public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('recurring', 'debt', 'card')),
  ref_id uuid not null,
  due_date date not null,
  paid_at timestamptz not null default now(),
  unique (user_id, kind, ref_id, due_date)
);

create index if not exists idx_bill_payments_user_due on public.bill_payments (user_id, due_date);

alter table public.bill_payments enable row level security;

drop policy if exists "own bill_payments" on public.bill_payments;
create policy "own bill_payments" on public.bill_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.bill_payments to authenticated, service_role;
