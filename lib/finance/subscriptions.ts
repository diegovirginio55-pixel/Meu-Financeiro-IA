import type { Transaction } from "./types";
import { isGasto } from "./fluxo";

/**
 * Reduz uma descrição de transação a uma "chave" que identifica o mesmo
 * cobrador/assinatura ao longo de vários meses, ignorando números, datas e
 * códigos que mudam a cada cobrança (ex.: "Netflix.com 05/06" e
 * "Netflix.com 07/05" caem na mesma chave).
 */
export function subscriptionKey(description: string): string {
  return description
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[0-9]/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ")
    .trim();
}

export type SubscriptionEntry = { date: string; amount: number; description: string };

export interface SubscriptionGroup {
  key: string;
  label: string;
  byMonth: Map<string, SubscriptionEntry>;
  months: string[];
}

/**
 * Agrupa as saídas por "assinatura" (mesma chave de descrição), pegando o
 * último lançamento de cada mês para representar aquele mês. Só retorna
 * grupos com pelo menos `minMonths` meses distintos, ou seja, que parecem
 * mesmo recorrentes e não uma coincidência isolada.
 */
export function groupSubscriptions(transactions: Transaction[], minMonths = 3): SubscriptionGroup[] {
  const byKey = new Map<string, SubscriptionEntry[]>();
  transactions.filter(isGasto).forEach((t) => {
    const key = subscriptionKey(t.description);
    if (key.length < 4) return;
    const list = byKey.get(key) ?? [];
    list.push({ date: t.date, amount: Number(t.amount), description: t.description });
    byKey.set(key, list);
  });

  const groups: SubscriptionGroup[] = [];
  byKey.forEach((entries, key) => {
    const byMonth = new Map<string, SubscriptionEntry>();
    entries.forEach((entry) => {
      const monthKey = entry.date.slice(0, 7);
      const existing = byMonth.get(monthKey);
      if (!existing || entry.date > existing.date) byMonth.set(monthKey, entry);
    });
    const months = Array.from(byMonth.keys()).sort();
    if (months.length < minMonths) return;
    const label = byMonth.get(months[months.length - 1])!.description.trim();
    groups.push({ key, label, byMonth, months });
  });

  return groups;
}
