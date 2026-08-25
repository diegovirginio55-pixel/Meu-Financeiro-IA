import type { Account, Card, Debt, RecurringItem, Transaction } from "./types";
import { assetMatchesBank, connectionBank, realConnectionId } from "./connection-filter";
import { isInvestmentMovement } from "./investment-movements";
import { differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";

export function isGasto(transaction: Transaction): boolean {
  return transaction.type === "saida" && !isInvestmentMovement(transaction);
}

export function isRenda(transaction: Transaction): boolean {
  return transaction.type === "entrada" && !isInvestmentMovement(transaction);
}

export function saoPauloTodayKey(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function saoPauloHour(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value ?? "0") % 24;
}

export function greetingForNow(date = new Date()): string {
  const hour = saoPauloHour(date);
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function saoPauloWeekStartKey(date = new Date()): string {
  return format(startOfWeek(parseISO(saoPauloTodayKey(date)), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function sumGastosInRange(transactions: Transaction[], from: string, to: string): number {
  return transactions
    .filter((item) => isGasto(item) && item.date >= from && item.date <= to)
    .reduce((sum, item) => sum + Number(item.amount), 0);
}

export function nextMonthDay5Key(todayKey = saoPauloTodayKey()): string {
  const [year, month] = todayKey.split("-").map(Number);
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return `${next.year}-${String(next.month).padStart(2, "0")}-05`;
}

export function daysUntilInclusive(fromKey: string, toKey: string): number {
  const from = parseISO(`${fromKey}T12:00:00`);
  const to = parseISO(`${toKey}T12:00:00`);
  return Math.max(1, differenceInCalendarDays(to, from) + 1);
}

export function dailyBudgetFromBalance(
  balance: number,
  todayKey = saoPauloTodayKey(),
): { perDay: number; days: number; until: string } {
  const until = nextMonthDay5Key(todayKey);
  const days = daysUntilInclusive(todayKey, until);
  const available = Math.max(0, Number(balance) || 0);
  return { perDay: available / days, days, until };
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
