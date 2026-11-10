// Sem "use client": usado no servidor (app/(app)/3d/page.tsx), no cliente e nos testes.
import { categoryColor } from "./categories";
import { isGasto, isRenda, shiftMonthKey } from "./fluxo";
import type { BalancePoint } from "./balance-history";
import type { Transaction } from "./types";

export const VISTAS_3D = ["cidade", "moedas", "galaxia", "montanha", "holograma"] as const;
export type Vista3D = (typeof VISTAS_3D)[number];

export const OUTROS = "Outros";
/** Quantas categorias aparecem com nome próprio; o resto vira "Outros". */
export const TOP_CATEGORIES = 6;
/** Teto de compras desenhadas como estrelas na galáxia. */
export const MAX_GALAXY_POINTS = 400;
/** Meses do seletor e da montanha (o atual + 11 anteriores). */
export const MONTHS_BACK = 12;

export type CategorySlice = {
  name: string;
  value: number;
  /** Quantos gastos entraram nesta fatia. */
  count: number;
  color: string;
  /** Fração do total de gastos (0 a 1). */
  share: number;
};

export type GastoPoint = {
  id: string;
  description: string;
  value: number;
  date: string;
  /** Nome da fatia (categoria do top 6 ou "Outros"). */
  category: string;
};

export type MonthSpending = {
  categories: CategorySlice[];
  totalGastos: number;
  gastosCount: number;
  totalEntradas: number;
  /** As maiores compras do mês (no máximo MAX_GALAXY_POINTS), em ordem de data. */
  points: GastoPoint[];
  /** Compras que ficaram de fora da galáxia por causa do teto. */
  pointsOmitted: number;
};

const cents = (value: number) => Math.round(value * 100) / 100;

function sliceName(category: string | null | undefined): string {
  const name = (category ?? "").trim();
  return name || OUTROS;
}

function positiveAmount(value: number | string): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/**
 * Soma por categoria, das maiores para as menores. As `top` maiores ficam com
 * o nome próprio; as demais (e a própria categoria "Outros") viram uma fatia
 * "Outros", sempre a última. Valores zerados ou negativos são ignorados.
 */
export function groupByCategory(
  items: { category: string | null; amount: number | string }[],
  top = TOP_CATEGORIES,
): CategorySlice[] {
  const sums = new Map<string, { value: number; count: number }>();
  for (const item of items) {
    const amount = positiveAmount(item.amount);
    if (amount <= 0) continue;
    const name = sliceName(item.category);
    const entry = sums.get(name) ?? { value: 0, count: 0 };
    entry.value += amount;
    entry.count += 1;
    sums.set(name, entry);
  }

  const total = Array.from(sums.values()).reduce((sum, entry) => sum + entry.value, 0);
  if (total <= 0) return [];

  const named = Array.from(sums.entries())
    .filter(([name]) => name !== OUTROS)
    .sort((a, b) => b[1].value - a[1].value || a[0].localeCompare(b[0], "pt-BR"));
  const kept = named.slice(0, Math.max(0, top));
  const rest = named.slice(Math.max(0, top));
  const outros = sums.get(OUTROS) ?? { value: 0, count: 0 };
  for (const [, entry] of rest) {
    outros.value += entry.value;
    outros.count += entry.count;
  }

  const slices = kept.map(([name, entry]) => ({ name, value: entry.value, count: entry.count }));
  if (outros.count > 0) slices.push({ name: OUTROS, value: outros.value, count: outros.count });

  return slices.map((slice) => ({
    ...slice,
    value: cents(slice.value),
    color: categoryColor(slice.name),
    share: slice.value / total,
  }));
}

/** Gastos (por categoria e um a um) e entradas de um mês "AAAA-MM". */
export function summarizeMonthSpending(
  transactions: Transaction[],
  monthKey: string,
  { top = TOP_CATEGORIES, maxPoints = MAX_GALAXY_POINTS }: { top?: number; maxPoints?: number } = {},
): MonthSpending {
  const inMonth = transactions.filter((transaction) => transaction.date.slice(0, 7) === monthKey);
  const gastos = inMonth.filter((transaction) => isGasto(transaction) && positiveAmount(transaction.amount) > 0);
  const categories = groupByCategory(gastos, top);
  const named = new Set(categories.map((slice) => slice.name));

  const points = gastos
    .map((transaction) => {
      const name = sliceName(transaction.category);
      return {
        id: transaction.id,
        description: transaction.description?.trim() || "Sem descrição",
        value: cents(positiveAmount(transaction.amount)),
        date: transaction.date.slice(0, 10),
        category: named.has(name) ? name : OUTROS,
      };
    })
    .sort((a, b) => b.value - a.value || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const kept = points.slice(0, Math.max(0, maxPoints));
  kept.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const totalEntradas = inMonth
    .filter(isRenda)
    .reduce((sum, transaction) => sum + positiveAmount(transaction.amount), 0);

  return {
    categories,
    totalGastos: cents(categories.reduce((sum, slice) => sum + slice.value, 0)),
    gastosCount: gastos.length,
    totalEntradas: cents(totalEntradas),
    points: kept,
    pointsOmitted: points.length - kept.length,
  };
}

/** Valores possíveis de cada moeda, do menor para o maior. */
export const COIN_UNITS = [100, 200, 500, 1000] as const;
/** Acima disso a pilha fica alta demais para contar; aí cada moeda passa a valer mais. */
export const MAX_COINS_PER_STACK = 40;

export function coinCount(value: number, unit: number): number {
  if (!(unit > 0) || !(value > 0)) return 0;
  return Math.round(value / unit);
}

/** Menor valor de moeda em que a maior categoria cabe em até ~40 moedas. */
export function pickCoinUnit(maxCategoryValue: number): number {
  for (const unit of COIN_UNITS) {
    if (coinCount(maxCategoryValue, unit) <= MAX_COINS_PER_STACK) return unit;
  }
  return COIN_UNITS[COIN_UNITS.length - 1];
}

export type BalanceDay = { day: number; balance: number };

export type BalanceMonth = {
  monthKey: string;
  label: string;
  days: BalanceDay[];
  avg: number;
  max: BalanceDay;
  min: BalanceDay;
};

/** Saldo diário agrupado por mês, do mais antigo para o mais novo (no máximo `months`). */
export function groupBalanceByMonth(history: BalancePoint[], months = MONTHS_BACK): BalanceMonth[] {
  const byMonth = new Map<string, BalanceDay[]>();
  for (const point of history) {
    const key = point.date.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push({ day: Number(point.date.slice(8, 10)), balance: point.balance });
    byMonth.set(key, list);
  }
  return Array.from(byMonth.keys())
    .sort()
    .slice(-Math.max(0, months))
    .map((monthKey) => {
      const days = (byMonth.get(monthKey) ?? []).sort((a, b) => a.day - b.day);
      let max = days[0];
      let min = days[0];
      let sum = 0;
      for (const day of days) {
        sum += day.balance;
        if (day.balance > max.balance) max = day;
        if (day.balance < min.balance) min = day;
      }
      return { monthKey, label: shortMonthLabel(monthKey), days, avg: cents(sum / days.length), max, min };
    });
}

/** Variação do saldo médio entre o primeiro e o último mês (em %), ou null se não der para comparar. */
export function balanceGrowthPercent(months: BalanceMonth[]): number | null {
  if (months.length < 2) return null;
  const first = months[0].avg;
  const last = months[months.length - 1].avg;
  if (!(first > 0)) return null;
  return Math.round((last / first - 1) * 100);
}

const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTH_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-11" → "nov/26". */
export function shortMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${MONTH_SHORT[Number(month) - 1] ?? month}/${year.slice(2)}`;
}

/** "2026-11" → "novembro". */
export function monthName(monthKey: string): string {
  return MONTH_LONG[Number(monthKey.slice(5, 7)) - 1] ?? monthKey;
}

/** "2026-11" → "Novembro de 2026". */
export function monthTitle(monthKey: string): string {
  const name = monthName(monthKey);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${monthKey.slice(0, 4)}`;
}

/** Mês atual e os 11 anteriores, do mais novo para o mais antigo. */
export function monthOptions(currentMonthKey: string, count = MONTHS_BACK): { key: string; label: string }[] {
  return Array.from({ length: count }, (_, index) => {
    const key = shiftMonthKey(currentMonthKey, -index);
    return { key, label: monthTitle(key) };
  });
}

/** `?mes=AAAA-MM` válido (mês atual ou até 11 antes); qualquer outra coisa vira o mês atual. */
export function parseMonthParam(value: string | string[] | undefined, currentMonthKey: string): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return currentMonthKey;
  const oldest = shiftMonthKey(currentMonthKey, -(MONTHS_BACK - 1));
  return value < oldest || value > currentMonthKey ? currentMonthKey : value;
}

export function parseVista(value: string | string[] | undefined): Vista3D {
  return typeof value === "string" && (VISTAS_3D as readonly string[]).includes(value) ? (value as Vista3D) : "cidade";
}
