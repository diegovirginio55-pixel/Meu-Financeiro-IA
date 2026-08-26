-- Registro de notificações já enviadas (alertas inteligentes e resumo
-- semanal), para não avisar a mesma coisa mais de uma vez.

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,
  ref_key text not null,
  sent_at timestamptz not null default now()
);

create unique index if not exists idx_notification_log_unique
  on public.notification_log (user_id, kind, ref_key);

alter table public.notification_log enable row level security;

drop policy if exists "own notification_log" on public.notification_log;
create policy "own notification_log" on public.notification_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.notification_log to service_role;
