// Sem "use client": usado no servidor e no cliente. Toda data/hora da interface usa o fuso
// de São Paulo — o servidor roda em UTC e, sem isso, o HTML do servidor e o do celular divergem.

export const APP_TIME_ZONE = "America/Sao_Paulo";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "yyyy-MM-dd" do dia em São Paulo. */
export function saoPauloDayKey(value: Date | string | number): string {
  return dayKeyFormatter.format(toDate(value));
}

/** "14:05" no horário de São Paulo. */
export function formatTimeSP(value: Date | string | number): string {
  return timeFormatter.format(toDate(value));
}

/** "09/11/2026" no horário de São Paulo. */
export function formatDateSP(value: Date | string | number): string {
  return dateFormatter.format(toDate(value));
}

/** "hoje às 15:05", "ontem às 17:33", "amanhã às 21:07" ou "em 05/11/2026 às 09:00" (fuso de São Paulo). */
export function formatRelativeDaySP(value: Date | string | number, now: Date = new Date()): string {
  const days = calendarDaysAgoSP(value, now);
  const time = formatTimeSP(value);
  if (days === 0) return `hoje às ${time}`;
  if (days === 1) return `ontem às ${time}`;
  if (days === -1) return `amanhã às ${time}`;
  return `em ${formatDateSP(value)} às ${time}`;
}

/** Diferença em dias de calendário (São Paulo) entre `value` e `now`. 0 = hoje, 1 = ontem. */
export function calendarDaysAgoSP(value: Date | string | number, now: Date = new Date()): number {
  const a = Date.parse(`${saoPauloDayKey(now)}T00:00:00Z`);
  const b = Date.parse(`${saoPauloDayKey(value)}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}
