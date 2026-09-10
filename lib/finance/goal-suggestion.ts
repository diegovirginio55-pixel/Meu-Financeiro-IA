import type { Transaction } from "./types";
import { isGasto, isRenda, lastNMonthKeys, saoPauloMonthKey } from "./fluxo";

/**
 * Sugere um valor mensal de aporte pra uma meta nova, baseado na capacidade
 * média de economia dos últimos meses (entradas - saídas). Sugere metade
 * dessa sobra (pra não comprometer o orçamento todo) com um mínimo de R$50.
 */
export function suggestMonthlyContribution(transactions: Transaction[], now: Date = new Date()): number {
  const thisMonth = saoPauloMonthKey(now);
  const pastMonths = lastNMonthKeys(6, thisMonth).slice(0, -1);

  const monthlySavings = pastMonths.map((key) => {
    const monthTx = transactions.filter((t) => t.date.startsWith(key));
    const entradas = monthTx.filter(isRenda).reduce((s, t) => s + Number(t.amount), 0);
    const saidas = monthTx.filter(isGasto).reduce((s, t) => s + Number(t.amount), 0);
    return entradas - saidas;
  });

  const validMonths = monthlySavings.filter((v) => v > 0);
  if (validMonths.length === 0) return 0;

  const average = validMonths.reduce((s, v) => s + v, 0) / validMonths.length;
  return Math.max(50, Math.round((average / 2) / 10) * 10);
}
