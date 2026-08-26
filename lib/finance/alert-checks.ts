import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Card, Debt, RecurringItem, Transaction } from "./types";
import {
  isGasto,
  isRenda,
  lastNMonthKeys,
  saoPauloMonthKey,
  saoPauloMonthStartKey,
  saoPauloTodayKey,
  saoPauloWeekStartKey,
  shiftMonthKey,
} from "./fluxo";
import { resolvedCategory } from "./categories";
import { formatCurrency } from "./format";

export interface AlertCandidate {
  kind: string;
  refKey: string;
  title: string;
  body: string;
  url: string;
}

const LOW_BALANCE_HORIZON_DAYS = 7;
const CATEGORY_SPIKE_MULTIPLIER = 1.4;
const CATEGORY_SPIKE_MIN_AVERAGE = 30;

/**
 * Calcula os alertas inteligentes pendentes para um usuário: fatura de
 * cartão perto de vencer, saldo previsto ficando negativo nos próximos
 * dias, e gasto de alguma categoria muito acima da média dos últimos
 * meses. Não envia nada — apenas retorna candidatos; quem chama decide
 * se já foi avisado antes (notification_log) e dispara o push.
 */
export async function computeSmartAlerts(
  supabase: SupabaseClient,
  userId: string,
): Promise<AlertCandidate[]> {
  const now = new Date();
  const todayStr = saoPauloTodayKey(now);
  const thisMonth = saoPauloMonthKey(now);
  const monthKeys = lastNMonthKeys(4, thisMonth);
  const historyStart = `${monthKeys[0]}-01`;

  const [accountsRes, cardsRes, recurringRes, debtsRes, txRes] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", userId),
    supabase.from("cards").select("*").eq("user_id", userId),
    supabase.from("recurring_items").select("*").eq("user_id", userId).eq("active", true),
    supabase.from("debts").select("*").eq("user_id", userId).eq("paid", false),
    supabase.from("transactions").select("*").eq("user_id", userId).gte("date", historyStart),
  ]);

  const accounts = (accountsRes.data ?? []) as Account[];
  const cards = (cardsRes.data ?? []) as Card[];
  const recurring = (recurringRes.data ?? []) as RecurringItem[];
  const debts = (debtsRes.data ?? []) as Debt[];
  const tx = (txRes.data ?? []) as Transaction[];

  const alerts: AlertCandidate[] = [];
  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance), 0);

  // 1) Fatura de cartão vencendo em até 3 dias
  for (const card of cards) {
    if (!card.due_day || Number(card.current_invoice) <= 0) continue;
    const day = Math.min(Math.max(1, card.due_day), 28);
    let due = `${thisMonth}-${String(day).padStart(2, "0")}`;
    if (due < todayStr) due = `${shiftMonthKey(thisMonth, 1)}-${String(day).padStart(2, "0")}`;
    const daysUntil = Math.round(
      (new Date(`${due}T12:00:00`).getTime() - new Date(`${todayStr}T12:00:00`).getTime()) / 86_400_000,
    );
    if (daysUntil >= 0 && daysUntil <= 3) {
      alerts.push({
        kind: "card_due",
        refKey: `${card.id}:${due}`,
        title: "Fatura chegando 💳",
        body: `${card.name} vence ${daysUntil === 0 ? "hoje" : `em ${daysUntil} dia${daysUntil === 1 ? "" : "s"}`} · ${formatCurrency(Number(card.current_invoice))}`,
        url: "/dashboard",
      });
    }
  }

  // 2) Saldo previsto ficando negativo nos próximos dias
  const upcoming: { date: string; delta: number }[] = [];
  for (const item of recurring) {
    if (!item.active) continue;
    const day = Math.min(Math.max(1, item.day_of_month), 28);
    let occurrence = `${thisMonth}-${String(day).padStart(2, "0")}`;
    if (occurrence < todayStr) occurrence = `${shiftMonthKey(thisMonth, 1)}-${String(day).padStart(2, "0")}`;
    upcoming.push({ date: occurrence, delta: item.type === "entrada" ? Number(item.amount) : -Number(item.amount) });
  }
  for (const debt of debts) {
    if (!debt.due_date) continue;
    upcoming.push({ date: debt.due_date, delta: -Number(debt.amount) });
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  const limitDate = new Date(`${todayStr}T12:00:00`);
  limitDate.setDate(limitDate.getDate() + LOW_BALANCE_HORIZON_DAYS);
  const limitStr = limitDate.toISOString().slice(0, 10);

  let running = totalBalance;
  let lowestPoint = totalBalance;
  for (const item of upcoming) {
    if (item.date < todayStr || item.date > limitStr) continue;
    running += item.delta;
    if (running < lowestPoint) lowestPoint = running;
  }

  if (lowestPoint < 0) {
    alerts.push({
      kind: "low_balance",
      refKey: saoPauloWeekStartKey(now),
      title: "Saldo pode ficar negativo ⚠️",
      body: `Com as contas previstas, seu saldo pode chegar a ${formatCurrency(lowestPoint)} nos próximos ${LOW_BALANCE_HORIZON_DAYS} dias.`,
      url: "/fluxo",
    });
  }

  // 3) Gasto de alguma categoria muito acima da média dos últimos meses
  const monthStart = saoPauloMonthStartKey(now);
  const dayOfMonth = Number(todayStr.slice(8, 10));
  const daysInMonth = new Date(Number(thisMonth.slice(0, 4)), Number(thisMonth.slice(5, 7)), 0).getDate();

  const currentByCategory = new Map<string, number>();
  tx
    .filter((t) => t.date >= monthStart && isGasto(t))
    .forEach((t) => {
      const category = resolvedCategory(t);
      currentByCategory.set(category, (currentByCategory.get(category) ?? 0) + Number(t.amount));
    });

  const pastMonths = monthKeys.slice(0, -1);
  const pastByCategory = new Map<string, number[]>();
  pastMonths.forEach((monthKey) => {
    const totals = new Map<string, number>();
    tx
      .filter((t) => t.date.startsWith(monthKey) && isGasto(t))
      .forEach((t) => {
        const category = resolvedCategory(t);
        totals.set(category, (totals.get(category) ?? 0) + Number(t.amount));
      });
    totals.forEach((value, category) => {
      const list = pastByCategory.get(category) ?? [];
      list.push(value);
      pastByCategory.set(category, list);
    });
  });

  if (dayOfMonth >= 5) {
    currentByCategory.forEach((total, category) => {
      const history = pastByCategory.get(category) ?? [];
      if (history.length < 2) return;
      const average = history.reduce((s, v) => s + v, 0) / pastMonths.length;
      if (average < CATEGORY_SPIKE_MIN_AVERAGE) return;
      const projected = (total / dayOfMonth) * daysInMonth;
      if (projected > average * CATEGORY_SPIKE_MULTIPLIER) {
        alerts.push({
          kind: "category_spike",
          refKey: `${thisMonth}:${category}`,
          title: `Gasto alto em ${category} 📈`,
          body: `Nesse ritmo, "${category}" deve fechar em ${formatCurrency(projected)} este mês, bem acima da média de ${formatCurrency(average)}.`,
          url: "/detalhes",
        });
      }
    });
  }

  return alerts;
}

/**
 * Resumo da semana anterior (entradas, saídas, saldo), enviado uma vez
 * por semana. Retorna null se ainda não passou uma semana completa ou
 * se não houve nenhuma movimentação para resumir.
 */
export async function computeWeeklySummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<AlertCandidate | null> {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(now);
  if (weekday !== "Mon") return null;

  const currentWeekStart = saoPauloWeekStartKey(now);
  const previousWeekStart = new Date(`${currentWeekStart}T12:00:00`);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const from = previousWeekStart.toISOString().slice(0, 10);
  const to = new Date(`${currentWeekStart}T12:00:00`);
  to.setDate(to.getDate() - 1);
  const toStr = to.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", toStr);

  const tx = (data ?? []) as Transaction[];
  if (tx.length === 0) return null;

  const entradas = tx.filter(isRenda).reduce((s, t) => s + Number(t.amount), 0);
  const saidas = tx.filter(isGasto).reduce((s, t) => s + Number(t.amount), 0);
  const saldo = entradas - saidas;

  return {
    kind: "weekly_summary",
    refKey: from,
    title: "Resumo da semana 📊",
    body: `Entrou ${formatCurrency(entradas)}, saiu ${formatCurrency(saidas)} · saldo da semana: ${formatCurrency(saldo)}`,
    url: "/visao",
  };
}
