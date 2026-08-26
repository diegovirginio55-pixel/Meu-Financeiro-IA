import type { Card, Debt, RecurringItem } from "./types";
import { saoPauloTodayKey, shiftMonthKey } from "./fluxo";

export type CalendarEventKind = "salario" | "conta_fixa" | "cartao" | "divida";

export interface CalendarEvent {
  id: string;
  date: string;
  kind: CalendarEventKind;
  description: string;
  amount: number;
  type: "entrada" | "saida";
}

export interface FinancialCalendar {
  events: CalendarEvent[];
  balanceByDate: Map<string, number>;
  rangeStart: string;
  rangeEnd: string;
  todayKey: string;
}

function daysInMonthOf(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function clampDay(day: number, monthKey: string): number {
  return Math.min(Math.max(1, day), daysInMonthOf(monthKey));
}

function addDaysKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Próxima data de vencimento da fatura do cartão a partir de hoje. */
function cardNextDue(card: Card, todayKey: string): string | null {
  if (!card.due_day || Number(card.current_invoice) <= 0) return null;
  const thisMonth = todayKey.slice(0, 7);
  const day = clampDay(card.due_day, thisMonth);
  let due = `${thisMonth}-${String(day).padStart(2, "0")}`;
  if (due < todayKey) {
    const nextMonth = shiftMonthKey(thisMonth, 1);
    const nextDay = clampDay(card.due_day, nextMonth);
    due = `${nextMonth}-${String(nextDay).padStart(2, "0")}`;
  }
  return due;
}

/**
 * Monta o calendário financeiro: salário, contas fixas e vencimento de
 * dívidas/faturas para os próximos meses, mais o saldo em conta projetado
 * dia a dia (uma "escada" que só muda de valor no dia de cada evento).
 * Contas fixas e salário se repetem todo mês pelo dia cadastrado; dívidas
 * aparecem só no mês da data de vencimento; cartão só mostra a próxima
 * fatura conhecida (não dá para prever faturas futuras que ainda não existem).
 */
export function buildFinancialCalendar({
  totalBalance,
  recurring,
  debts,
  cards,
  now = new Date(),
  monthsAhead = 3,
}: {
  totalBalance: number;
  recurring: RecurringItem[];
  debts: Debt[];
  cards: Card[];
  now?: Date;
  monthsAhead?: number;
}): FinancialCalendar {
  const todayKey = saoPauloTodayKey(now);
  const startMonth = todayKey.slice(0, 7);
  const monthKeys = Array.from({ length: monthsAhead + 1 }, (_, i) => shiftMonthKey(startMonth, i));
  const rangeStart = `${monthKeys[0]}-01`;
  const lastMonth = monthKeys[monthKeys.length - 1];
  const rangeEnd = `${lastMonth}-${String(daysInMonthOf(lastMonth)).padStart(2, "0")}`;

  const events: CalendarEvent[] = [];

  monthKeys.forEach((monthKey) => {
    recurring
      .filter((item) => item.active)
      .forEach((item) => {
        const day = clampDay(item.day_of_month, monthKey);
        events.push({
          id: `rec-${item.id}-${monthKey}`,
          date: `${monthKey}-${String(day).padStart(2, "0")}`,
          kind: item.type === "entrada" ? "salario" : "conta_fixa",
          description: item.description,
          amount: Number(item.amount),
          type: item.type,
        });
      });
  });

  debts
    .filter((d) => !d.paid && d.due_date)
    .forEach((d) => {
      const date = d.due_date as string;
      if (date < rangeStart || date > rangeEnd) return;
      events.push({
        id: `debt-${d.id}`,
        date,
        kind: "divida",
        description: d.person ? `${d.description} (${d.person})` : d.description,
        amount: Number(d.amount),
        type: "saida",
      });
    });

  cards.forEach((card) => {
    const due = cardNextDue(card, todayKey);
    if (!due || due > rangeEnd) return;
    events.push({
      id: `card-${card.id}`,
      date: due,
      kind: "cartao",
      description: `Fatura ${card.name}`,
      amount: Number(card.current_invoice),
      type: "saida",
    });
  });

  events.sort((a, b) => a.date.localeCompare(b.date));

  const balanceByDate = new Map<string, number>();
  const futureEvents = events.filter((e) => e.date >= todayKey);
  let running = totalBalance;
  let cursor = todayKey;
  let index = 0;
  while (cursor <= rangeEnd) {
    while (index < futureEvents.length && futureEvents[index].date === cursor) {
      running += futureEvents[index].type === "entrada" ? futureEvents[index].amount : -futureEvents[index].amount;
      index += 1;
    }
    balanceByDate.set(cursor, running);
    cursor = addDaysKey(cursor, 1);
  }

  return { events, balanceByDate, rangeStart, rangeEnd, todayKey };
}
