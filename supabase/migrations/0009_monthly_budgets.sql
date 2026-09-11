-- Orçamento mensal: quanto o usuário está disposto a gastar e a economizar
-- em cada mês. Usado na tela "Metas" (card "Orçamento do mês") e pelos
-- alertas inteligentes (avisa se o ritmo de gastos vai passar do orçamento
-- ou se a meta de economia do mês está em risco).
create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month_key text not null,
  spending_limit numeric(14,2),
  savings_target numeric(14,2),
    10|  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_monthly_budgets_unique
  on public.monthly_budgets (user_id, month_key);

alter table public.monthly_budgets enable row level security;

drop policy if exists "own monthly_budgets" on public.monthly_budgets;
    20|create policy "own monthly_budgets" on public.monthly_budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.monthly_budgets to service_role;
