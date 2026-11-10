import { shiftMonthKey } from "./fluxo";

/**
 * Parcelas do cartão (núcleo puro): a partir das compras com
 * creditCardMetadata da Pluggy (parcela N de M), quanto das próximas
 * faturas já está comprometido.
 */
export type InstallmentSource = {
  description?: string;
  amount: number;
  date: string;
  creditCardMetadata?: {
    installmentNumber?: number | null;
    totalInstallments?: number | null;
    purchaseDate?: string | null;
    billForecastDate?: string | null;
  } | null;
};

/** Uma parcela que vai cair numa fatura futura. */
export type FutureInstallment = { description: string; amount: number; number: number; total: number; monthKey: string };

function monthOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}` : null;
}

function monthDiff(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/**
 * Parcelas que caem em faturas DEPOIS de `currentInvoiceMonth`. Usa as
 * parcelas futuras que a Pluggy já mandou e projeta as que ainda não
 * apareceram (N+1…M, uma por mês a partir da última vista).
 */
export function futureInstallments(transactions: InstallmentSource[], currentInvoiceMonth: string): FutureInstallment[] {
  type Group = { description: string; total: number; amount: number; seen: Map<number, string> };
  const groups = new Map<string, Group>();

  for (const transaction of transactions) {
    const meta = transaction.creditCardMetadata;
    const total = Number(meta?.totalInstallments ?? 0);
    const number = Number(meta?.installmentNumber ?? 0);
    if (!meta || total < 2 || number < 1 || number > total) continue;
    const amount = Math.round(Math.abs(Number(transaction.amount)) * 100) / 100;
    if (!(amount > 0)) continue;
    const billMonth = monthOf(meta.billForecastDate) ?? monthOf(transaction.date);
    if (!billMonth) continue;
    const description = (transaction.description ?? "Compra parcelada").trim();
    const key = [description.toLowerCase(), total, amount, meta.purchaseDate ?? ""].join("|");
    const group = groups.get(key) ?? { description, total, amount, seen: new Map<number, string>() };
    group.seen.set(number, billMonth);
    groups.set(key, group);
  }

  const result: FutureInstallment[] = [];
  for (const group of groups.values()) {
    const numbers = [...group.seen.keys()].sort((a, b) => a - b);
    const last = numbers[numbers.length - 1];
    const lastMonth = group.seen.get(last) as string;
    for (let number = 1; number <= group.total; number += 1) {
      const monthKey = group.seen.get(number) ?? (number > last ? shiftMonthKey(lastMonth, number - last) : null);
      if (!monthKey || monthDiff(currentInvoiceMonth, monthKey) <= 0) continue;
      result.push({ description: group.description, amount: group.amount, number, total: group.total, monthKey });
    }
  }
  return result.sort((a, b) => a.monthKey.localeCompare(b.monthKey) || b.amount - a.amount);
}

/** Total por mês (próximos N meses depois da fatura atual). */
export function installmentsByMonth(
  items: FutureInstallment[],
  currentInvoiceMonth: string,
  months = 6,
): { monthKey: string; total: number; items: FutureInstallment[] }[] {
  return Array.from({ length: months }, (_, index) => {
    const monthKey = shiftMonthKey(currentInvoiceMonth, index + 1);
    const inMonth = items.filter((item) => item.monthKey === monthKey);
    return { monthKey, total: Math.round(inMonth.reduce((sum, item) => sum + item.amount, 0) * 100) / 100, items: inMonth };
  });
}
