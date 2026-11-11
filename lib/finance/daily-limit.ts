import type { Transaction } from "./types";
import { dailyBudgetFromBalance, isGasto, sumGastosInRange } from "./fluxo";

export type DailyLimitStatus = {
  /** Quanto dá para gastar por dia (0 se não sobrou nada). */
  perDay: number;
  /** Gastos de hoje (inclui os que chegaram pelas notificações do celular). */
  spentToday: number;
  /** Quanto ainda pode gastar hoje (0 se já passou). */
  remaining: number;
  /** Quanto passou do limite de hoje (0 se não passou). */
  over: number;
  /** De onde veio o limite: orçamento do mês ou saldo em conta até o próximo salário (5º dia útil). */
  basis: "budget" | "balance";
};

/**
 * Limite de gasto de hoje — o mesmo número do aviso "Seu limite de hoje" e
 * do aviso que sai a cada gasto. Com orçamento do mês definido:
 * (orçamento - gasto até ontem) / dias restantes. Sem orçamento: saldo em
 * conta dividido pelos dias até o próximo salário (5º dia útil).
 */
export function dailyLimitStatus({
  tx,
  totalBalance,
  spendingLimit,
  todayKey,
}: {
  tx: Transaction[];
  totalBalance: number;
  spendingLimit: number | null;
  todayKey: string;
}): DailyLimitStatus {
  const spentToday = sumGastosInRange(tx, todayKey, todayKey);
  let perDay: number;
  let basis: DailyLimitStatus["basis"];
  if (spendingLimit != null && spendingLimit > 0) {
    const monthKey = todayKey.slice(0, 7);
    const dayOfMonth = Number(todayKey.slice(8, 10));
    const daysInMonth = new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0).getDate();
    const daysLeftInMonth = Math.max(1, daysInMonth - dayOfMonth + 1);
    const monthSpent = tx
      .filter((item) => item.date.startsWith(monthKey) && isGasto(item))
      .reduce((sum, item) => sum + Number(item.amount), 0);
    // O limite de hoje vem do que sobrou ATÉ ONTEM (o gasto de hoje não é descontado duas vezes).
    const spentUntilYesterday = Math.max(0, monthSpent - spentToday);
    perDay = Math.max(0, spendingLimit - spentUntilYesterday) / daysLeftInMonth;
    basis = "budget";
  } else {
    perDay = dailyBudgetFromBalance(totalBalance, todayKey).perDay;
    basis = "balance";
  }
  return {
    perDay,
    spentToday,
    remaining: Math.max(0, perDay - spentToday),
    over: Math.max(0, spentToday - perDay),
    basis,
  };
}
