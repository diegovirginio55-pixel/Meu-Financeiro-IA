import { formatCurrency } from "./format";

/**
 * "Cor do mês" da tela inicial: verde quando está tranquilo, âmbar quando
 * os gastos passam do ritmo (ou o saldo aperta) e vermelho quando o
 * orçamento estoura ou o saldo fica negativo.
 */
export type MoodLevel = "ok" | "warn" | "bad";
export type MonthMood = { level: MoodLevel; label: string; detail: string };

export function monthMood({
  saldoConta,
  spent,
  limit,
  todayKey,
  perDay,
}: {
  saldoConta: number;
  spent: number;
  limit: number | null;
  todayKey: string;
  perDay: number;
}): MonthMood {
  const [year, month, day] = todayKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (saldoConta < 0) return { level: "bad", label: "Saldo negativo", detail: "O saldo em conta está negativo." };
  if (limit && limit > 0) {
    if (spent > limit) {
      return { level: "bad", label: "Orçamento estourado", detail: `Você passou ${formatCurrency(spent - limit)} do limite do mês.` };
    }
    const expected = limit * (day / daysInMonth);
    const ratio = expected > 0 ? spent / expected : 0;
    if (ratio > 1.15) {
      return {
        level: "warn",
        label: "Gastos acima do ritmo",
        detail: `${Math.round((ratio - 1) * 100)}% acima do ritmo do orçamento para esta altura do mês.`,
      };
    }
    return { level: "ok", label: "Mês tranquilo", detail: "Você está gastando dentro do ritmo do orçamento." };
  }
  if (perDay < 20) {
    return { level: "warn", label: "Saldo apertado", detail: `Dá para gastar ${formatCurrency(perDay)} por dia até o próximo salário.` };
  }
  return { level: "ok", label: "Mês tranquilo", detail: `Dá para gastar ${formatCurrency(perDay)} por dia até o próximo salário.` };
}
