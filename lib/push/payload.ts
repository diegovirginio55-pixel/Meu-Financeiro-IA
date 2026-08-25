import { formatCurrency } from "@/lib/finance/format";

export const NOTIFY_MAX_AGE_DAYS = 2;

export type MovementNotice = {
  description: string;
  amount: number;
  type: "entrada" | "saida" | string;
  date?: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

function calendarAgeDays(date: string, today: string): number {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  if (!year || !month || !day || !todayYear || !todayMonth || !todayDay) return Number.POSITIVE_INFINITY;
  return Math.round((Date.UTC(todayYear, todayMonth - 1, todayDay) - Date.UTC(year, month - 1, day)) / 86_400_000);
}

export function isRecentMovementDate(date: string | undefined, now = new Date()): boolean {
  if (!date) return false;
  const day = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const age = calendarAgeDays(day, today);
  return age >= -1 && age <= NOTIFY_MAX_AGE_DAYS;
}

export function recentMovements(movements: MovementNotice[]): MovementNotice[] {
  return movements.filter((item) => isRecentMovementDate(item.date));
}

export function movementPayloads(bankName: string, movements: MovementNotice[]): PushPayload[] {
  if (movements.length === 0) return [];

  if (movements.length > 6) {
    const saidas = movements.filter((item) => item.type === "saida").length;
    const entradas = movements.filter((item) => item.type === "entrada").length;
    const parts = [
      `${movements.length} movimentações novas`,
      entradas > 0 ? `${entradas} entrada${entradas === 1 ? "" : "s"}` : null,
      saidas > 0 ? `${saidas} saída${saidas === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    return [
      {
        title: bankName,
        body: parts.join(" · "),
        url: "/detalhes",
      },
    ];
  }

  return movements.map((item) => {
    const kind = item.type === "entrada" ? "Entrada" : item.type === "saida" ? "Saída" : "Movimentação";
    return {
      title: bankName,
      body: `${kind} de ${formatCurrency(Number(item.amount))} · ${item.description}`,
      url: "/detalhes",
    };
  });
}
