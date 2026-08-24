import type { Account, Card, Debt, RecurringItem, Transaction } from "./types";
import { assetMatchesBank, connectionBank, realConnectionId } from "./connection-filter";

export function isGasto(transaction: Transaction): boolean {
  return transaction.type === "saida" && transaction.category !== "Investimentos";
}

export function belongsToConnection(
  transaction: Transaction,
  connectionId: string,
  accounts: Account[],
  cards: Card[],
): boolean {
  if (connectionId === "all") return true;
  const realId = realConnectionId(connectionId);
  const bank = connectionBank(connectionId);
  const account = accounts.find((item) => item.id === transaction.account_id);
  const card = cards.find((item) => item.id === transaction.card_id);
  const asset = account ?? card;
  if (!asset || asset.bank_connection_id !== realId) return false;
  return assetMatchesBank(asset.name, bank);
}

export type FutureExpense = {
  id: string;
  description: string;
  amount: number;
  date: string;
};

export function futureExpensesInMonth(
  month: Date,
  recurring: RecurringItem[],
  debts: Debt[],
  today = new Date(),
): FutureExpense[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const isCurrentMonth = year === today.getFullYear() && monthIndex === today.getMonth();
  const isPastMonth = month < new Date(today.getFullYear(), today.getMonth(), 1);
  if (isPastMonth) return [];

  const items: FutureExpense[] = [];

  for (const item of recurring) {
    if (!item.active || item.type !== "saida") continue;
    const day = Math.min(item.day_of_month, 28);
    const date = new Date(year, monthIndex, day);
    if (isCurrentMonth && date < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      continue;
    }
    const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    items.push({
      id: `rec-${item.id}`,
      description: item.description,
      amount: Number(item.amount),
      date: iso,
    });
  }

  for (const debt of debts) {
    if (debt.paid || !debt.due_date) continue;
    const due = new Date(`${debt.due_date}T00:00:00`);
    if (due.getFullYear() !== year || due.getMonth() !== monthIndex) continue;
    if (isCurrentMonth && due < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      continue;
    }
    items.push({
      id: `debt-${debt.id}`,
      description: debt.person ? `${debt.description} (${debt.person})` : debt.description,
      amount: Number(debt.amount),
      date: debt.due_date,
    });
  }

  return items.sort((a, b) => a.date.localeCompare(b.date));
}
