import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Account,
  Card,
  Transaction,
  RecurringItem,
  Debt,
  Goal,
  Investment,
  InvestmentSnapshot,
  InvestmentTxn,
} from "./types";
import {
  daysAheadKey,
  isGasto,
  isRenda,
  lastNMonthKeys,
  saoPauloMonthEndKey,
  saoPauloMonthKey,
  saoPauloMonthStartKey,
  saoPauloTodayKey,
  saoPauloWeekStartKey,
  nextMonthlyOccurrenceKey,
  sumGastosInRange,
  dailyBudgetFromBalance,
} from "./fluxo";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { applyProvisionalToBalances, loadProvisional } from "@/lib/ingest/provisional";
import { resolvedCategory } from "./categories";
import { uniqueInvestments } from "./bank-connections";
import { applicationTxAsBuys, withAccruedYield } from "./investment-yield";
import type { MonthlyBudget } from "./budget";

export interface UpcomingItem {
  description: string;
  amount: number;
  type: "entrada" | "saida";
  date: string;
  origem: "recorrente" | "divida";
}

export interface FinancialSnapshot {
  accounts: Account[];
  cards: Card[];
  debts: Debt[];
  goals: Goal[];
  investments: Investment[];
  totalBalance: number;
  totalInvoices: number;
  totalInvestments: number;
  totalDebts: number;
  patrimonio: number;
  monthEntradas: number;
  monthDespesas: number;
  economia: number;
  gastosHoje: number;
  gastosSemana: number;
  gastoDiarioAteDia5: number;
  diasAteDia5: number;
  dataLimiteDia5: string;
  gastosPorCategoria: { category: string; total: number }[];
  maioresGastos: Transaction[];
  proximos30Dias: UpcomingItem[];
  saldoPrevisto30Dias: number;
  evolucaoMensal: { mes: string; entradas: number; despesas: number }[];
  historyTx: Transaction[];
  recurringItems: RecurringItem[];
  monthlyBudget: MonthlyBudget | null;
}

/**
 * Calcula toda a "fotografia" financeira do usuário: saldos, faturas,
 * patrimônio, gastos do mês, previsão dos próximos 30 dias e evolução
 * dos últimos 6 meses. Usado tanto pelo Dashboard quanto pela IA (contexto do chat).
 */
export async function getFinancialSnapshot(
  supabase: SupabaseClient,
): Promise<FinancialSnapshot> {
  const now = new Date();
  const monthStart = saoPauloMonthStartKey(now);
  const monthEnd = saoPauloMonthEndKey(now);
  const sixMonthsAgo = `${lastNMonthKeys(6, saoPauloMonthKey(now))[0]}-01`;
  // historyTx precisa ir um pouco além de 12 meses pra dar pra comparar o mês
  // atual com o mesmo mês do ano passado em "Meu mês".
  const thirteenMonthsAgo = `${lastNMonthKeys(13, saoPauloMonthKey(now))[0]}-01`;

  const [
    accountsRes,
    cardsRes,
    investmentsRes,
    debtsRes,
    goalsRes,
    recurringRes,
    monthTxRes,
    historyTxRes,
    snapRes,
    invTxRes,
    budgetRes,
    connectionsRes,
    provisional,
  ] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at"),
    supabase.from("cards").select("*").order("created_at"),
    supabase
      .from("investments")
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase.from("debts").select("*").order("due_date", { ascending: true }),
    supabase.from("goals").select("*").order("created_at"),
    supabase.from("recurring_items").select("*").eq("active", true),
    fetchAllRows<Transaction>((from, to) =>
      supabase
        .from("transactions")
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    // Paginado: com mais de 1000 lançamentos em 13 meses a consulta era
    // cortada (e, sem ordenação, num pedaço aleatório do histórico).
    fetchAllRows<Transaction>((from, to) =>
      supabase
        .from("transactions")
        .select("*")
        .gte("date", thirteenMonthsAgo)
        .order("date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    supabase.from("investment_snapshots").select("*").gte("snapshot_date", sixMonthsAgo),
    supabase.from("investment_transactions").select("*").gte("date", sixMonthsAgo),
    supabase.from("monthly_budgets").select("*").eq("month_key", saoPauloMonthKey(now)).maybeSingle(),
    supabase.from("bank_connections").select("id, status_detail, last_synced_at"),
    loadProvisional(supabase),
  ]);

  // Saldo estimado: banco + notificações do celular ainda não confirmadas pela Pluggy.
  const { accounts, cards } = applyProvisionalToBalances(
    (accountsRes.data ?? []) as Account[],
    (cardsRes.data ?? []) as Card[],
    provisional,
    (connectionsRes.data ?? []) as { id: string; status_detail: string | null; last_synced_at: string | null }[],
  );
  const debts = (debtsRes.data ?? []) as Debt[];
  const goals = (goalsRes.data ?? []) as Goal[];
  const recurringItems = (recurringRes.data ?? []) as RecurringItem[];
  const monthTx = (monthTxRes.data ?? []) as Transaction[];
  const historyTx = (historyTxRes.data ?? []) as Transaction[];
  const uniqueInv = uniqueInvestments((investmentsRes.data ?? []) as Investment[]);
  const investments = withAccruedYield(
    uniqueInv,
    (snapRes.data ?? []) as InvestmentSnapshot[],
    [
      ...((invTxRes.data ?? []) as InvestmentTxn[]),
      ...applicationTxAsBuys(uniqueInv, historyTx),
    ],
  );

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalInvoices = cards.reduce(
    (s, c) => s + Number(c.current_invoice),
    0,
  );
  const totalInvestments = investments.reduce(
    (s, i) => s + Number(i.amount),
    0,
  );
  const totalDebts = debts
    .filter((d) => !d.paid)
    .reduce((s, d) => s + Number(d.amount), 0);
  const patrimonio =
    totalBalance + totalInvestments - totalInvoices - totalDebts;

  const monthEntradas = monthTx
    .filter(isRenda)
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthDespesas = monthTx
    .filter(isGasto)
    .reduce((s, t) => s + Number(t.amount), 0);
  const economia = monthEntradas - monthDespesas;

  const todayKey = saoPauloTodayKey(now);
  const weekStart = saoPauloWeekStartKey(now);
  const gastosHoje = sumGastosInRange(historyTx, todayKey, todayKey);
  const gastosSemana = sumGastosInRange(historyTx, weekStart, todayKey);
  const dailyBudget = dailyBudgetFromBalance(totalBalance, todayKey);

  const categoriaMap = new Map<string, number>();
  monthTx
    .filter(isGasto)
    .forEach((t) => {
      const category = resolvedCategory(t);
      categoriaMap.set(category, (categoriaMap.get(category) ?? 0) + Number(t.amount));
    });
  const gastosPorCategoria = Array.from(categoriaMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const maioresGastos = [...monthTx]
    .filter(isGasto)
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5);

  const todayStr = saoPauloTodayKey(now);
  const limitStr = daysAheadKey(30, now);
  const proximos30Dias: UpcomingItem[] = [];

  recurringItems.forEach((item) => {
    // Dia real do mês (31 vira 30/28 quando o mês é mais curto) — antes
    // tudo acima de 28 era tratado como dia 28.
    const occurrence = nextMonthlyOccurrenceKey(Math.max(1, item.day_of_month), todayStr);
    if (occurrence <= limitStr) {
      proximos30Dias.push({
        description: item.description,
        amount: Number(item.amount),
        type: item.type,
        date: occurrence,
        origem: "recorrente",
      });
    }
  });

  debts
    .filter((d) => !d.paid && d.due_date)
    .forEach((d) => {
      const due = d.due_date as string;
      if (due >= todayStr && due <= limitStr) {
        proximos30Dias.push({
          description: `Dívida: ${d.description}${d.person ? ` (${d.person})` : ""}`,
          amount: Number(d.amount),
          type: "saida",
          date: due,
          origem: "divida",
        });
      }
    });

  proximos30Dias.sort((a, b) => a.date.localeCompare(b.date));

  // Faturas de cartão que vencem nos próximos 30 dias também saem do saldo.
  const faturasAVencer = cards.reduce((sum, card) => {
    const invoice = Number(card.current_invoice) || 0;
    if (invoice <= 0 || !card.due_day) return sum;
    return nextMonthlyOccurrenceKey(card.due_day, todayStr) <= limitStr ? sum + invoice : sum;
  }, 0);

  const saldoPrevisto30Dias =
    totalBalance -
    faturasAVencer +
    proximos30Dias.reduce(
      (s, i) => s + (i.type === "entrada" ? i.amount : -i.amount),
      0,
    );

  const evolucaoMap = new Map<string, { entradas: number; despesas: number }>();
  for (const key of lastNMonthKeys(6, saoPauloMonthKey(now))) {
    evolucaoMap.set(key, { entradas: 0, despesas: 0 });
  }
  historyTx.forEach((t) => {
    const key = t.date.slice(0, 7);
    const bucket = evolucaoMap.get(key);
    if (!bucket) return;
    if (isRenda(t)) bucket.entradas += Number(t.amount);
    else if (isGasto(t)) bucket.despesas += Number(t.amount);
  });
  const evolucaoMensal = Array.from(evolucaoMap.entries()).map(
    ([mes, v]) => ({ mes, ...v }),
  );

  const budgetRow = budgetRes.data as { spending_limit: number | null; savings_target: number | null } | null;
  const monthlyBudget: MonthlyBudget | null = budgetRow
    ? {
        monthKey: saoPauloMonthKey(now),
        spendingLimit: budgetRow.spending_limit,
        savingsTarget: budgetRow.savings_target,
      }
    : null;

  return {
    accounts,
    cards,
    debts,
    goals,
    investments,
    totalBalance,
    totalInvoices,
    totalInvestments,
    totalDebts,
    patrimonio,
    monthEntradas,
    monthDespesas,
    economia,
    gastosHoje,
    gastosSemana,
    gastoDiarioAteDia5: dailyBudget.perDay,
    diasAteDia5: dailyBudget.days,
    dataLimiteDia5: dailyBudget.until,
    gastosPorCategoria,
    maioresGastos,
    proximos30Dias,
    saldoPrevisto30Dias,
    evolucaoMensal,
    historyTx,
    recurringItems,
    monthlyBudget,
  };
}
