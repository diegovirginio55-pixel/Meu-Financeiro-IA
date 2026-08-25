import type { Account, Card, Debt, RecurringItem, Transaction } from "./types";
import { assetMatchesBank, connectionBank, realConnectionId } from "./connection-filter";
import { isInvestmentMovement } from "./investment-movements";
import { isTransferDescription } from "./categories";
import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";

export function isGasto(transaction: Transaction): boolean {
  return (
    transaction.type === "saida" &&
    !isInvestmentMovement(transaction) &&
    !isTransferDescription(transaction.description)
  );
}

export function isRenda(transaction: Transaction): boolean {
  return (
    transaction.type === "entrada" &&
    !isInvestmentMovement(transaction) &&
    !isTransferDescription(transaction.description)
  );
}

export function saoPauloTodayKey(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function toSaoPauloDateOnly(value: Date | string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return trimmed.slice(0, 10);
    return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  }
  return value.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function saoPauloMonthKey(date = new Date()): string {
  return saoPauloTodayKey(date).slice(0, 7);
}

export function saoPauloMonthStartKey(date = new Date()): string {
  return `${saoPauloMonthKey(date)}-01`;
}

export function saoPauloMonthEndKey(date = new Date()): string {
  const monthKey = saoPauloMonthKey(date);
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthKey}-${String(lastDay).padStart(2, "0")}`;
}

export function saoPauloYearStartKey(date = new Date()): string {
  return `${saoPauloTodayKey(date).slice(0, 4)}-01-01`;
}

export function daysAgoKey(days: number, date = new Date()): string {
  const [year, month, day] = saoPauloTodayKey(date).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
}

export function daysAheadKey(days: number, date = new Date()): string {
  return daysAgoKey(-days, date);
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function lastNMonthKeys(count: number, from = saoPauloMonthKey()): string[] {
  return Array.from({ length: count }, (_, index) => shiftMonthKey(from, index - (count - 1)));
}

export function lastNDateKeys(count: number, from = saoPauloTodayKey()): string[] {
  const end = parseISO(`${from}T12:00:00`);
  return Array.from({ length: count }, (_, index) => format(subDays(end, count - 1 - index), "yyyy-MM-dd"));
}

export function saoPauloHour(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value ?? "0") % 24;
}

export const OWNER_NAME = "Diego Isidoro";

export function greetingForNow(date = new Date()): string {
  const hour = saoPauloHour(date);
  const greeting = hour >= 5 && hour < 12 ? "Bom Dia" : hour >= 12 && hour < 18 ? "Boa Tarde" : "Boa Noite";
  return `${greeting} ${OWNER_NAME}`;
}

export function saoPauloWeekStartKey(date = new Date()): string {
  const [year, month, day] = saoPauloTodayKey(date).split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysFromMonday = (weekday + 6) % 7;
  return new Date(Date.UTC(year, month - 1, day - daysFromMonday)).toISOString().slice(0, 10);
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
