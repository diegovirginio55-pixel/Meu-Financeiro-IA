import type { Transaction } from "./types";
import type { AlertCandidate } from "./alert-checks";
import { isGasto, isRenda, saoPauloTodayKey, shiftMonthKey } from "./fluxo";
import { resolvedCategory } from "./categories";
import { merchantBrand } from "./merchants";

/**
 * Retrospectiva do mês (núcleo puro): os destaques para as telas em
 * sequência — quanto gastou e a comparação com o mês anterior, a categoria
 * que mais pesou, o "favorito" (onde mais comprou), o dia mais caro e
 * quanto sobrou.
 */
export type MonthRecap = {
  monthKey: string;
  spent: number;
  prevSpent: number;
  /** Variação dos gastos contra o mês anterior (0,12 = 12% a mais); null sem base. */
  change: number | null;
  perDay: number;
  income: number;
  saved: number;
  count: number;
  topCategory: { name: string; total: number; share: number } | null;
  favorite: { name: string; count: number; total: number } | null;
  priciestDay: { date: string; total: number; mainDescription: string } | null;
  biggest: { description: string; amount: number; date: string } | null;
};

function sum(list: Transaction[]): number {
  return Math.round(list.reduce((s, t) => s + Number(t.amount), 0) * 100) / 100;
}

/** Nome de "lugar" para agrupar compras: a marca conhecida ou as 2 primeiras palavras da descrição. */
export function placeName(description: string): string {
  const brand = merchantBrand(description);
  if (brand) return brand.name;
  const words = description
    .replace(/[*#\d]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .join(" ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1).toLowerCase() : description.trim();
}

export function buildMonthRecap({
  monthKey,
  monthTx,
  prevMonthTx,
  daysCounted,
}: {
  monthKey: string;
  monthTx: Transaction[];
  prevMonthTx: Transaction[];
  /** Quantos dias do mês já passaram (mês inteiro para meses fechados). */
  daysCounted: number;
}): MonthRecap {
  const gastos = monthTx.filter(isGasto);
  const spent = sum(gastos);
  const prevSpent = sum(prevMonthTx.filter(isGasto));
  const income = sum(monthTx.filter(isRenda));

  const byCategory = new Map<string, number>();
  for (const t of gastos) byCategory.set(resolvedCategory(t), (byCategory.get(resolvedCategory(t)) ?? 0) + Number(t.amount));
  const topCat = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];

  // Favorito: onde comprou mais vezes (pelo menos 2), sem contar pagamentos de conta fixa grandes.
  const byPlace = new Map<string, { count: number; total: number }>();
  for (const t of gastos) {
    const name = placeName(t.description);
    const current = byPlace.get(name) ?? { count: 0, total: 0 };
    byPlace.set(name, { count: current.count + 1, total: current.total + Number(t.amount) });
  }
  const fav = [...byPlace.entries()].filter(([, v]) => v.count >= 2).sort((a, b) => b[1].count - a[1].count || b[1].total - a[1].total)[0];

  const byDay = new Map<string, Transaction[]>();
  for (const t of gastos) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]);
  const priciest = [...byDay.entries()].map(([date, list]) => ({ date, total: sum(list), list })).sort((a, b) => b.total - a.total)[0];

  const biggest = [...gastos].sort((a, b) => Number(b.amount) - Number(a.amount))[0];

  return {
    monthKey,
    spent,
    prevSpent,
    change: prevSpent > 0 ? (spent - prevSpent) / prevSpent : null,
    perDay: daysCounted > 0 ? Math.round((spent / daysCounted) * 100) / 100 : 0,
    income,
    saved: Math.round((income - spent) * 100) / 100,
    count: gastos.length,
    topCategory: topCat ? { name: topCat[0], total: Math.round(topCat[1] * 100) / 100, share: spent > 0 ? topCat[1] / spent : 0 } : null,
    favorite: fav ? { name: fav[0], count: fav[1].count, total: Math.round(fav[1].total * 100) / 100 } : null,
    priciestDay: priciest
      ? {
          date: priciest.date,
          total: priciest.total,
          mainDescription: [...priciest.list].sort((a, b) => Number(b.amount) - Number(a.amount))[0].description,
        }
      : null,
    biggest: biggest ? { description: biggest.description, amount: Number(biggest.amount), date: biggest.date } : null,
  };
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const monthName = (monthKey: string) => MONTHS[Number(monthKey.slice(5, 7)) - 1] ?? monthKey;

/** Nos 3 primeiros dias do mês: "sua retrospectiva do mês passado está pronta" (uma vez por mês). */
export function recapReminder(now = new Date()): AlertCandidate | null {
  const today = saoPauloTodayKey(now);
  if (Number(today.slice(8, 10)) > 3) return null;
  const previous = shiftMonthKey(today.slice(0, 7), -1);
  return {
    kind: "month_recap",
    refKey: previous,
    title: `Sua retrospectiva de ${monthName(previous)} está pronta ✨`,
    body: "Veja quanto você gastou, onde mais foi o dinheiro e quanto sobrou.",
    url: `/retrospectiva?mes=${previous}`,
  };
}
