import type { SupabaseClient } from "@supabase/supabase-js";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  addDays,
  format,
  setDate,
} from "date-fns";
import type {
  Account,
  Card,
  Transaction,
  RecurringItem,
  Debt,
  Goal,
  Investment,
} from "./types";
import { isGasto, isRenda, saoPauloTodayKey, saoPauloWeekStartKey, sumGastosInRange, dailyBudgetFromBalance } from "./fluxo";
import { resolvedCategory } from "./categories";
import { uniqueInvestments } from "./bank-connections";

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
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const sixMonthsAgo = format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd");

  const [
    accountsRes,
    cardsRes,
    investmentsRes,
    debtsRes,
    goalsRes,
    recurringRes,
    monthTxRes,
    historyTxRes,
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
    supabase
      .from("transactions")
      .select("*")
      .gte("date", monthStart)
      .lte("date", monthEnd),
    supabase.from("transactions").select("*").gte("date", sixMonthsAgo),
  ]);

  const accounts = (accountsRes.data ?? []) as Account[];
  const cards = (cardsRes.data ?? []) as Card[];
  const investments = uniqueInvestments((investmentsRes.data ?? []) as Investment[]);
  const debts = (debtsRes.data ?? []) as Debt[];
  const goals = (goalsRes.data ?? []) as Goal[];
  const recurringItems = (recurringRes.data ?? []) as RecurringItem[];
  const monthTx = (monthTxRes.data ?? []) as Transaction[];
  const historyTx = (historyTxRes.data ?? []) as Transaction[];

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

  const todayStr = format(now, "yyyy-MM-dd");
  const limitDate = addDays(now, 30);
  const proximos30Dias: UpcomingItem[] = [];

  recurringItems.forEach((item) => {
    let occurrence = setDate(now, item.day_of_month);
    if (format(occurrence, "yyyy-MM-dd") < todayStr) {
      occurrence = setDate(addMonths(now, 1), item.day_of_month);
    }
    if (occurrence <= limitDate) {
      proximos30Dias.push({
        description: item.description,
        amount: Number(item.amount),
        type: item.type,
        date: format(occurrence, "yyyy-MM-dd"),
        origem: "recorrente",
      });
    }
  });

  debts
    .filter((d) => !d.paid && d.due_date)
    .forEach((d) => {
      const due = new Date(d.due_date as string);
      if (due <= limitDate) {
        proximos30Dias.push({
          description: `Dívida: ${d.description}${d.person ? ` (${d.person})` : ""}`,
          amount: Number(d.amount),
          type: "saida",
          date: d.due_date as string,
          origem: "divida",
        });
      }
    });

  proximos30Dias.sort((a, b) => a.date.localeCompare(b.date));

  const saldoPrevisto30Dias =
    totalBalance +
    proximos30Dias.reduce(
      (s, i) => s + (i.type === "entrada" ? i.amount : -i.amount),
      0,
    );

  const evolucaoMap = new Map<string, { entradas: number; despesas: number }>();
  for (let i = 5; i >= 0; i--) {
    const key = format(startOfMonth(subMonths(now, i)), "yyyy-MM");
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
  };
}
