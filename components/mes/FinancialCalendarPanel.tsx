"use client";

import { useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, formatDate } from "@/lib/finance/format";
import { compactShort } from "@/components/dashboard/chart-theme";
import { SectionLabel, SoftPanel } from "@/components/ui/page-chrome";
import type { CalendarEvent, CalendarEventKind, FinancialCalendar } from "@/lib/finance/financial-calendar";

const KIND_COLOR: Record<CalendarEventKind, string> = {
  salario: "#34d399",
  conta_fixa: "#fbbf24",
  cartao: "#a855f7",
  divida: "#fb7185",
};

const KIND_ICON: Record<CalendarEventKind, string> = {
  salario: "💰",
  conta_fixa: "🏠",
  cartao: "💳",
  divida: "🧾",
};

const KIND_LABEL: Record<CalendarEventKind, string> = {
  salario: "Salário/receita",
  conta_fixa: "Conta fixa",
  cartao: "Fatura de cartão",
  divida: "Dívida",
};

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

function monthTitle(month: Date): string {
  const raw = format(month, "MMMM 'de' yyyy", { locale: ptBR });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function FinancialCalendarPanel({ calendar }: { calendar: FinancialCalendar }) {
  const minMonth = calendar.rangeStart.slice(0, 7);
  const maxMonth = calendar.rangeEnd.slice(0, 7);
  const todayMonth = calendar.todayKey.slice(0, 7);
  const [monthKey, setMonthKey] = useState(todayMonth);

  const month = useMemo(() => new Date(`${monthKey}-01T12:00:00`), [monthKey]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    calendar.events.forEach((event) => {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    });
    return map;
  }, [calendar.events]);

  const upcoming = useMemo(
    () => calendar.events.filter((event) => event.date >= calendar.todayKey).slice(0, 8),
    [calendar.events, calendar.todayKey],
  );

  function shiftMonth(delta: number) {
    const next = format(addMonths(month, delta), "yyyy-MM");
    if (next < minMonth || next > maxMonth) return;
    setMonthKey(next);
  }

  return (
    <SoftPanel className="relative overflow-hidden p-5 lg:p-6">
      <div className="pointer-events-none absolute -left-12 -top-16 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-sm">📅</span>
        <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Calendário financeiro</h2>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={monthKey <= minMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition hover:border-zinc-700 hover:text-white disabled:opacity-30"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-zinc-100">{monthTitle(month)}</p>
          {monthKey !== todayMonth && (
            <button
              type="button"
              onClick={() => setMonthKey(todayMonth)}
              className="rounded-full border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 hover:border-emerald-700 hover:text-emerald-300"
            >
              Hoje
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={monthKey >= maxMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition hover:border-zinc-700 hover:text-white disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="relative mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-zinc-600">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
      <div className="relative mt-1.5 grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, month);
          const events = eventsByDate.get(dateStr) ?? [];
          const balance = calendar.balanceByDate.get(dateStr);
          const isToday = dateStr === calendar.todayKey;
          const showBalance = inMonth && balance != null && dateStr >= calendar.todayKey;
          return (
            <div
              key={dateStr}
              className={`flex min-h-[58px] flex-col items-center rounded-xl border p-1 pt-1.5 text-[10px] transition ${
                inMonth
                  ? isToday
                    ? "border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]"
                    : "border-zinc-800/70 bg-zinc-950/40 hover:border-zinc-700"
                  : "border-transparent"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  isToday ? "bg-emerald-400 font-bold text-zinc-950" : inMonth ? "text-zinc-400" : "text-zinc-700"
                }`}
              >
                {day.getDate()}
              </span>
              {inMonth && events.length > 0 && (
                <span className="mt-1 flex flex-wrap justify-center gap-0.5">
                  {events.slice(0, 4).map((event) => (
                    <span
                      key={event.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: KIND_COLOR[event.kind] }}
                    />
                  ))}
                </span>
              )}
              {showBalance && (
                <span
                  className={`mt-auto truncate text-[9px] font-medium ${
                    (balance as number) < 0 ? "text-rose-400" : "text-zinc-500"
                  }`}
                >
                  {compactShort(balance as number)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="relative mt-4 flex flex-wrap gap-2">
        {(Object.keys(KIND_LABEL) as CalendarEventKind[]).map((kind) => (
          <span
            key={kind}
            className="flex items-center gap-1.5 rounded-full bg-zinc-800/60 px-2.5 py-1 text-[11px] text-zinc-400"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: KIND_COLOR[kind] }} />
            {KIND_LABEL[kind]}
          </span>
        ))}
      </div>

      <div className="relative mt-6">
        <SectionLabel>Próximos eventos</SectionLabel>
        {upcoming.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum evento previsto.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                    style={{ backgroundColor: `${KIND_COLOR[event.kind]}22` }}
                  >
                    {KIND_ICON[event.kind]}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-zinc-200">{event.description}</span>
                    <span className="text-[11px] text-zinc-500">{formatDate(event.date)}</span>
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    event.type === "entrada" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-300"
                  }`}
                >
                  {event.type === "entrada" ? "+" : "-"}
                  {formatCurrency(event.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SoftPanel>
  );
}
