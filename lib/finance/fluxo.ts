import type { Account, Card, Debt, RecurringItem, Transaction } from "./types";
import { assetMatchesBank, connectionBank, realConnectionId } from "./connection-filter";
import { isInvestmentMovement } from "./investment-movements";
import { isCardBillPayment, isInternalTransfer } from "./categories";
import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";

/**
 * Movimentação que só troca dinheiro de lugar (não é gasto nem renda):
 * aplicação/resgate de investimento, transferência entre contas e
 * pagamento de fatura de cartão.
 */
export function isInternalMovement(transaction: Transaction): boolean {
  return isInvestmentMovement(transaction) || isInternalTransfer(transaction) || isCardBillPayment(transaction);
}

export function isGasto(transaction: Transaction): boolean {
  return transaction.type === "saida" && !isInternalMovement(transaction);
}

export function isRenda(transaction: Transaction): boolean {
  return transaction.type === "entrada" && !isInternalMovement(transaction);
}

export function saoPauloTodayKey(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function toSaoPauloDateOnly(value: Date | string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    // Bancos que só informam o dia chegam da Pluggy como meia-noite UTC
    // exata. Convertida para Brasília, viraria 21h do dia ANTERIOR (e uma
    // compra do dia 1º caía no mês passado). Nesse caso, vale a data escrita.
    if (/^\d{4}-\d{2}-\d{2}T00:00(:00(\.0+)?)?(Z|[+-]00:?00)$/.test(trimmed)) return trimmed.slice(0, 10);
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

function dateKeyUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), em UTC. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Dias sem expediente bancário no país: feriados nacionais + Carnaval, Sexta-feira Santa e Corpus Christi. */
function bankHolidays(year: number): Set<string> {
  const fixed = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"].map((day) => `${year}-${day}`);
  const easter = easterSunday(year).getTime();
  const movable = [-48, -47, -2, 60].map((offset) => dateKeyUTC(new Date(easter + offset * 86_400_000)));
  return new Set([...fixed, ...movable]);
}

/** N-ésimo dia útil do mês (seg–sex, fora feriados bancários), como "YYYY-MM-DD". month: 1–12. */
export function nthBusinessDayKey(year: number, month: number, n: number): string {
  const holidays = bankHolidays(year);
  let count = 0;
  for (let day = 1; day <= lastDayOfMonth(year, month - 1); day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const weekday = date.getUTCDay();
    const key = dateKeyUTC(date);
    if (weekday === 0 || weekday === 6 || holidays.has(key)) continue;
    count += 1;
    if (count === n) return key;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDayOfMonth(year, month - 1)).padStart(2, "0")}`;
}

/** Dia útil em que o salário costuma cair (CLT: até o 5º dia útil do mês). */
export const PAYDAY_BUSINESS_DAY = 5;

/**
 * Próximo dia de salário: o 5º dia útil — ainda neste mês se hoje for antes
 * dele. Antes era o dia 5 fixo, que adiantava o salário em até 4 dias (em
 * nov/2026 o 5º dia útil é dia 9, por causa do feriado de Finados).
 */
export function nextPaydayKey(todayKey = saoPauloTodayKey()): string {
  const [year, month] = todayKey.split("-").map(Number);
  const thisMonth = nthBusinessDayKey(year, month, PAYDAY_BUSINESS_DAY);
  if (todayKey < thisMonth) return thisMonth;
  return month === 12
    ? nthBusinessDayKey(year + 1, 1, PAYDAY_BUSINESS_DAY)
    : nthBusinessDayKey(year, month + 1, PAYDAY_BUSINESS_DAY);
}

/** Último dia do mês (monthIndex começa em 0). */
export function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Dia D no mês, respeitando o tamanho real do mês: vencimento "dia 31" vira
 * 30 em abril e 28/29 em fevereiro (antes tudo acima de 28 virava 28).
 */
export function clampDayToMonth(year: number, monthIndex: number, day: number): number {
  return Math.max(1, Math.min(day, lastDayOfMonth(year, monthIndex)));
}

/** Próxima ocorrência (hoje inclusive) de um vencimento mensal no dia D, como "YYYY-MM-DD". */
export function nextMonthlyOccurrenceKey(dayOfMonth: number, todayKey = saoPauloTodayKey()): string {
  const [year, month, day] = todayKey.split("-").map(Number);
  const thisMonthDay = clampDayToMonth(year, month - 1, dayOfMonth);
  if (thisMonthDay >= day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(thisMonthDay).padStart(2, "0")}`;
  }
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthIndex = month === 12 ? 0 : month;
  const nextDay = clampDayToMonth(nextYear, nextMonthIndex, dayOfMonth);
  return `${nextYear}-${String(nextMonthIndex + 1).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
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
  const until = nextPaydayKey(todayKey);
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
    const day = clampDayToMonth(year, monthIndex, item.day_of_month);
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
