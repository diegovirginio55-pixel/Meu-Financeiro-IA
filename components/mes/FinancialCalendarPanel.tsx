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
  const [monthKey, setMonthKey] = useState(calendar.todayKey.slice(0, 7));

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
    <SoftPanel className="p-5 lg:p-6">
      <SectionLabel>Calendário financeiro</SectionLabel>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={monthKey <= minMonth}
          className="rounded-full border border-zinc-800 px-2 py-1 text-zinc-400 hover:text-white disabled:opacity-30"
        >
          ‹
        </button>
        <p className="text-sm font-medium text-zinc-100">{monthTitle(month)}</p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={monthKey >= maxMonth}
          className="rounded-full border border-zinc-800 px-2 py-1 text-zinc-400 hover:text-white disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-zinc-500">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, month);
          const events = eventsByDate.get(dateStr) ?? [];
          const balance = calendar.balanceByDate.get(dateStr);
          const isToday = dateStr === calendar.todayKey;
          return (
            <div
              key={dateStr}
              className={`flex min-h-[52px] flex-col rounded-lg border p-1 text-[10px] ${
                inMonth ? "border-zinc-800/80 bg-zinc-950/40" : "border-transparent"
              } ${isToday ? "ring-1 ring-emerald-400/70" : ""}`}
            >
              <span className={inMonth ? "text-zinc-400" : "text-zinc-700"}>{day.getDate()}</span>
              {inMonth && events.length > 0 && (
                <span className="mt-0.5 flex flex-wrap gap-0.5">
                  {events.slice(0, 4).map((event) => (
                    <span
                      key={event.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: KIND_COLOR[event.kind] }}
                    />
                  ))}
                </span>
              )}
              {inMonth && balance != null && dateStr >= calendar.todayKey && (
                <span className="mt-auto truncate text-[9px] text-zinc-500">{compactShort(balance)}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-zinc-500">
        {(Object.keys(KIND_LABEL) as CalendarEventKind[]).map((kind) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: KIND_COLOR[kind] }} />
            {KIND_LABEL[kind]}
          </span>
        ))}
      </div>

      <div className="mt-5">
        <SectionLabel>Próximos eventos</SectionLabel>
        {upcoming.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum evento previsto.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-800/80">
            {upcoming.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: KIND_COLOR[event.kind] }}
                  />
                  <span className="min-w-0 truncate text-zinc-200">{event.description}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className={`block font-medium ${event.type === "entrada" ? "text-emerald-400" : "text-rose-300"}`}
                  >
                    {event.type === "entrada" ? "+" : "-"}
                    {formatCurrency(event.amount)}
                  </span>
                  <span className="text-[11px] text-zinc-500">{formatDate(event.date)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SoftPanel>
  );
}
