import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Card, Debt, RecurringItem, Transaction } from "./types";
import {
  dailyBudgetFromBalance,
  isGasto,
  isRenda,
  lastNMonthKeys,
  saoPauloMonthKey,
  saoPauloMonthStartKey,
  saoPauloTodayKey,
  saoPauloWeekStartKey,
  shiftMonthKey,
  sumGastosInRange,
} from "./fluxo";
import { resolvedCategory } from "./categories";
import { formatCurrency } from "./format";
import { groupSubscriptions, subscriptionKey } from "./subscriptions";
import type { MonthlyBudget } from "./budget";

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
const SUBSCRIPTION_STABLE_TOLERANCE = 0.03;
const SUBSCRIPTION_MIN_INCREASE_PCT = 0.05;
const SUBSCRIPTION_MIN_INCREASE_ABS = 2;
const OVERSPEND_TODAY_MULTIPLIER = 1.3;
const OVERSPEND_TODAY_MIN_AMOUNT = 30;
const MONTH_PACE_HIGH_PCT = 20;
const MONTH_PACE_GOOD_PCT = -15;
const MONTH_PACE_MIN_AVERAGE = 100;
const BUDGET_PACE_HIGH_MULTIPLIER = 1.05;
const SAVINGS_AT_RISK_MIN_DAY = 10;
const SAVINGS_AT_RISK_PACE_RATIO = 0.7;

/**
 * Núcleo (puro, sem banco de dados) do cálculo dos alertas inteligentes:
 * fatura de cartão perto de vencer, saldo previsto ficando negativo nos
 * próximos dias, gasto de alguma categoria muito acima da média e assinatura
 * que ficou mais cara. Recebe os dados já carregados (útil tanto no
 * servidor/cron quanto no cliente, que já tem o snapshot financeiro em
 * memória) e apenas retorna candidatos — quem chama decide se já avisou
 * antes e dispara o push ou mostra na tela.
 */
export function computeSmartAlertsFromData({
  accounts,
  cards,
  recurring,
  debts,
  tx,
  budget = null,
  now = new Date(),
}: {
  accounts: Account[];
  cards: Card[];
  recurring: RecurringItem[];
  debts: Debt[];
  tx: Transaction[];
  budget?: MonthlyBudget | null;
  now?: Date;
}): AlertCandidate[] {
  const todayStr = saoPauloTodayKey(now);
  const thisMonth = saoPauloMonthKey(now);
  const monthKeys = lastNMonthKeys(5, thisMonth);

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

  // 3b) Ritmo geral do mês (todas as categorias somadas) — compara com o
  // orçamento que o usuário definiu para o mês (se ele existir) ou, na
  // falta disso, com a média histórica. Avisa se está gastando bem acima
  // ou bem abaixo do esperado, pra dar tempo de ajustar (ou parabenizar
  // quando está indo bem).
  const totalCurrentGasto = Array.from(currentByCategory.values()).reduce((s, v) => s + v, 0);
  const spendingLimit = budget?.spendingLimit && budget.spendingLimit > 0 ? budget.spendingLimit : null;

  let paceTarget: number | null = spendingLimit;
  let paceSourceLabel = "o orçamento que você definiu para este mês";
  if (paceTarget == null) {
    const pastTotalGastos = pastMonths
      .map((monthKey) => tx.filter((t) => t.date.startsWith(monthKey) && isGasto(t)).reduce((s, t) => s + Number(t.amount), 0))
      .filter((v) => v > 0);
    if (pastTotalGastos.length >= 2) {
      const media = pastTotalGastos.reduce((s, v) => s + v, 0) / pastTotalGastos.length;
      if (media >= MONTH_PACE_MIN_AVERAGE) {
        paceTarget = media;
        paceSourceLabel = `sua média histórica de ${formatCurrency(media)}`;
      }
    }
  }

  if (dayOfMonth >= 5 && paceTarget != null && paceTarget > 0) {
    const previsaoFimMes = (totalCurrentGasto / dayOfMonth) * daysInMonth;
    const ritmoPct = ((previsaoFimMes - paceTarget) / paceTarget) * 100;
    if (ritmoPct > (spendingLimit != null ? (BUDGET_PACE_HIGH_MULTIPLIER - 1) * 100 : MONTH_PACE_HIGH_PCT)) {
      alerts.push({
        kind: "month_pace_high",
        refKey: thisMonth,
        title: "Ritmo de gastos acima do normal 📈",
        body: `Nesse ritmo, o mês deve fechar com ${formatCurrency(previsaoFimMes)} em gastos — acima de ${paceSourceLabel}. Ainda dá tempo de ajustar.`,
        url: "/mes",
      });
    } else if (ritmoPct < MONTH_PACE_GOOD_PCT) {
      alerts.push({
        kind: "month_pace_good",
        refKey: thisMonth,
        title: "Você está economizando bem 🎉",
        body: `Nesse ritmo, o mês deve fechar com ${formatCurrency(previsaoFimMes)} em gastos — ${Math.round(Math.abs(ritmoPct))}% abaixo de ${paceSourceLabel}. Continue assim!`,
        url: "/mes",
      });
    }
  }

  // 3c) Quanto ainda pode gastar hoje sem comprometer o mês. Se houver um
  // orçamento definido, usa (orçamento - já gasto) / dias restantes; senão
  // cai no cálculo pelo saldo em conta até o dia 5 do mês seguinte. Avisa
  // se já passou bem do limite diário.
  const gastosHojeTotal = sumGastosInRange(tx, todayStr, todayStr);
  let perDayBudget: number;
  let perDaySourceNote: string;
  if (spendingLimit != null) {
    const daysLeftInMonth = Math.max(1, daysInMonth - dayOfMonth + 1);
    perDayBudget = Math.max(0, spendingLimit - totalCurrentGasto) / daysLeftInMonth;
    perDaySourceNote = "sem passar do orçamento deste mês";
  } else {
    perDayBudget = dailyBudgetFromBalance(totalBalance, todayStr).perDay;
    perDaySourceNote = "sem comprometer o resto do mês (baseado no saldo em conta)";
  }

  if (perDayBudget > 1) {
    const restante = Math.max(0, perDayBudget - gastosHojeTotal);
    alerts.push({
      kind: "daily_budget",
      refKey: todayStr,
      title: "Seu limite de hoje 💰",
      body:
        gastosHojeTotal > 0
          ? `Limite do dia: ${formatCurrency(perDayBudget)} · você já gastou ${formatCurrency(gastosHojeTotal)} hoje · ainda pode gastar ${formatCurrency(restante)}.`
          : `Hoje você pode gastar até ${formatCurrency(perDayBudget)} ${perDaySourceNote}.`,
      url: "/dashboard",
    });

    if (gastosHojeTotal > perDayBudget * OVERSPEND_TODAY_MULTIPLIER && gastosHojeTotal >= OVERSPEND_TODAY_MIN_AMOUNT) {
      alerts.push({
        kind: "overspend_today",
        refKey: todayStr,
        title: "Você passou do limite de hoje 🚨",
        body: `Já gastou ${formatCurrency(gastosHojeTotal)} hoje, ${formatCurrency(gastosHojeTotal - perDayBudget)} acima do limite diário de ${formatCurrency(perDayBudget)}. Tente compensar reduzindo gastos nos próximos dias.`,
        url: "/detalhes",
      });
    }
  } else if (totalBalance <= 0 && spendingLimit == null) {
    alerts.push({
      kind: "daily_budget",
      refKey: todayStr,
      title: "Saldo baixo hoje ⚠️",
      body: "Seu saldo em conta está zerado ou negativo. Se puder, evite novos gastos até a próxima entrada.",
      url: "/dashboard",
    });
  }

  // 3d) Meta de economia do mês (definida pelo usuário) — avisa se já
  // bateu a meta ou se o ritmo atual está longe de alcançá-la.
  const savingsTarget = budget?.savingsTarget && budget.savingsTarget > 0 ? budget.savingsTarget : null;
  if (savingsTarget != null) {
    const entradasMes = tx.filter((t) => t.date >= monthStart && isRenda(t)).reduce((s, t) => s + Number(t.amount), 0);
    const economiaAtual = entradasMes - totalCurrentGasto;
    if (economiaAtual >= savingsTarget) {
      alerts.push({
        kind: "savings_target_reached",
        refKey: thisMonth,
        title: "Meta de economia batida! 🎉",
        body: `Você já guardou ${formatCurrency(economiaAtual)} este mês, alcançando a meta de ${formatCurrency(savingsTarget)} que você definiu.`,
        url: "/metas",
      });
    } else if (dayOfMonth >= SAVINGS_AT_RISK_MIN_DAY) {
      const requiredPerDay = savingsTarget / daysInMonth;
      const currentPerDay = economiaAtual / dayOfMonth;
      if (currentPerDay < requiredPerDay * SAVINGS_AT_RISK_PACE_RATIO) {
        const faltam = Math.max(0, savingsTarget - economiaAtual);
        alerts.push({
          kind: "savings_target_at_risk",
          refKey: thisMonth,
          title: "Meta de economia em risco ⚠️",
          body: `Pra guardar ${formatCurrency(savingsTarget)} este mês, ainda faltam ${formatCurrency(faltam)} e restam ${Math.max(0, daysInMonth - dayOfMonth)} dia(s). Vale reduzir gastos variáveis pra recuperar o ritmo.`,
          url: "/metas",
        });
      }
    }
  }

  // 4) Assinatura/gasto recorrente que ficou mais caro de um mês para o outro
  const subscriptionGroups = groupSubscriptions(tx);

  subscriptionGroups.forEach(({ byMonth, months }) => {
    const lastMonth = months[months.length - 1];
    if (lastMonth !== thisMonth && lastMonth !== shiftMonthKey(thisMonth, -1)) return;

    const latest = byMonth.get(lastMonth)!;
    const priorMonths = months.slice(0, -1).slice(-3);
    if (priorMonths.length < 2) return;
    const priorAmounts = priorMonths.map((m) => byMonth.get(m)!.amount);
    const priorAvg = priorAmounts.reduce((s, v) => s + v, 0) / priorAmounts.length;
    const priorStable = priorAmounts.every(
      (a) => Math.abs(a - priorAvg) <= Math.max(1, priorAvg * SUBSCRIPTION_STABLE_TOLERANCE),
    );
    if (!priorStable) return;

    const increase = latest.amount - priorAvg;
    if (increase > Math.max(SUBSCRIPTION_MIN_INCREASE_ABS, priorAvg * SUBSCRIPTION_MIN_INCREASE_PCT)) {
      alerts.push({
        kind: "subscription_price_change",
        refKey: `${subscriptionKey(latest.description)}:${lastMonth}`,
        title: "Assinatura ficou mais cara 💸",
        body: `"${latest.description.trim()}" custava ${formatCurrency(priorAvg)} e agora está ${formatCurrency(latest.amount)} (+${formatCurrency(increase)}).`,
        url: "/detalhes",
      });
    }
  });

  return alerts;
}

/**
 * Versão que busca os dados no Supabase e delega para o núcleo puro. Usada
 * pelo cron (`runAlertsAndSummaries`) para todos os usuários.
 */
export async function computeSmartAlerts(
  supabase: SupabaseClient,
  userId: string,
): Promise<AlertCandidate[]> {
  const now = new Date();
  const thisMonth = saoPauloMonthKey(now);
  const monthKeys = lastNMonthKeys(5, thisMonth);
  const historyStart = `${monthKeys[0]}-01`;

  const [accountsRes, cardsRes, recurringRes, debtsRes, txRes, budgetRes] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", userId),
    supabase.from("cards").select("*").eq("user_id", userId),
    supabase.from("recurring_items").select("*").eq("user_id", userId).eq("active", true),
    supabase.from("debts").select("*").eq("user_id", userId).eq("paid", false),
    supabase.from("transactions").select("*").eq("user_id", userId).gte("date", historyStart),
    supabase.from("monthly_budgets").select("*").eq("user_id", userId).eq("month_key", thisMonth).maybeSingle(),
  ]);

  const budgetRow = budgetRes.data as { spending_limit: number | null; savings_target: number | null } | null;

  return computeSmartAlertsFromData({
    accounts: (accountsRes.data ?? []) as Account[],
    cards: (cardsRes.data ?? []) as Card[],
    recurring: (recurringRes.data ?? []) as RecurringItem[],
    debts: (debtsRes.data ?? []) as Debt[],
    tx: (txRes.data ?? []) as Transaction[],
    budget: budgetRow ? { monthKey: thisMonth, spendingLimit: budgetRow.spending_limit, savingsTarget: budgetRow.savings_target } : null,
    now,
  });
}

/**
 * Núcleo puro do resumo semanal (entradas, saídas, saldo). Retorna null se
 * ainda não passou uma semana completa ou se não houve nenhuma movimentação
 * para resumir.
 */
export function computeWeeklySummaryFromData({
  tx,
  now = new Date(),
}: {
  tx: Transaction[];
  now?: Date;
}): AlertCandidate | null {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(now);
  if (weekday !== "Mon") return null;

  const currentWeekStart = saoPauloWeekStartKey(now);
  const previousWeekStart = new Date(`${currentWeekStart}T12:00:00`);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const from = previousWeekStart.toISOString().slice(0, 10);
  const to = new Date(`${currentWeekStart}T12:00:00`);
  to.setDate(to.getDate() - 1);
  const toStr = to.toISOString().slice(0, 10);

  const weekTx = tx.filter((t) => t.date >= from && t.date <= toStr);
  if (weekTx.length === 0) return null;

  const entradas = weekTx.filter(isRenda).reduce((s, t) => s + Number(t.amount), 0);
  const saidas = weekTx.filter(isGasto).reduce((s, t) => s + Number(t.amount), 0);
  const saldo = entradas - saidas;

  return {
    kind: "weekly_summary",
    refKey: from,
    title: "Resumo da semana 📊",
    body: `Entrou ${formatCurrency(entradas)}, saiu ${formatCurrency(saidas)} · saldo da semana: ${formatCurrency(saldo)}`,
    url: "/visao",
  };
}

/**
 * Resumo da semana anterior, buscando os dados no Supabase. Enviado uma vez
 * por semana (toda segunda-feira) pelo cron.
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

  return computeWeeklySummaryFromData({ tx: (data ?? []) as Transaction[], now });
}
