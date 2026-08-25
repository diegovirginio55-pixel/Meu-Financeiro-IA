import { differenceInCalendarDays, parseISO } from "date-fns";
import { isInvestmentDescription, investmentNamesMatch } from "@/lib/finance/investment-movements";
import { saoPauloTodayKey } from "@/lib/finance/fluxo";
import type { Investment, InvestmentSnapshot, InvestmentTxn, Transaction } from "@/lib/finance/types";

/** CDI anual aproximado quando a Pluggy não manda o valor de mercado. */
export const CDI_ANNUAL_FALLBACK = 14.9;

function toDateKey(value: string): string {
  return value.slice(0, 10);
}

function productShareOfCdi(investment: Investment): number {
  const stored = Number(investment.last_month_rate ?? 0);
  if (stored > 5 && stored <= 200) return stored;
  const haystack = `${investment.name} ${investment.type ?? ""}`.toUpperCase();
  const named = haystack.match(/(\d{2,3})\s*%?\s*(DO\s*)?CDI/);
  if (named) return Number(named[1]);
  if (/\bLCD\b/.test(haystack)) return 84;
  if (/\b(LCI|LCA|CDB)\b/.test(haystack)) return 90;
  return 90;
}

export function monthlyYieldPercent(investment: Investment): number {
  const stored = Number(investment.last_month_rate ?? 0);
  if (stored !== 0 && Math.abs(stored) <= 5) return stored;
  return Number(((CDI_ANNUAL_FALLBACK * productShareOfCdi(investment)) / 100 / 12).toFixed(4));
}

export function holdingDaysFrom(
  snapshots: InvestmentSnapshot[],
  transactions: InvestmentTxn[],
): number {
  const today = saoPauloTodayKey();
  const starts = [
    ...transactions.filter((item) => item.type === "BUY").map((item) => toDateKey(item.date)),
    ...snapshots.map((item) => toDateKey(item.snapshot_date)),
  ]
    .filter(Boolean)
    .sort();
  const start = starts[0] ?? today;
  return Math.max(
    1,
    differenceInCalendarDays(parseISO(`${today}T12:00:00`), parseISO(`${start}T12:00:00`)),
  );
}

export function applicationTxAsBuys(
  investments: Investment[],
  transactions: Array<Pick<Transaction, "id" | "description" | "amount" | "date">>,
): InvestmentTxn[] {
  const applications = transactions.filter((item) => isInvestmentDescription(item.description));
  const used = new Set<string>();
  const extra: InvestmentTxn[] = [];

  for (const investment of investments) {
    const original = Number(investment.amount_original ?? investment.amount ?? 0);
    const candidates = applications
      .filter((item) => !used.has(item.id) && investmentNamesMatch(investment.name, item.description))
      .sort((left, right) => {
        const distance = (item: typeof left) => Math.abs(Number(item.amount) - original);
        return distance(left) - distance(right);
      });
    const chosen = candidates[0];
    if (!chosen) continue;
    used.add(chosen.id);
    extra.push({
      id: chosen.id,
      investment_id: investment.id,
      bank_connection_id: investment.bank_connection_id ?? null,
      type: "BUY",
      amount: Number(chosen.amount),
      date: chosen.date,
    });
  }

  return extra;
}

export function withAccruedYield(
  investments: Investment[],
  snapshots: InvestmentSnapshot[] = [],
  transactions: InvestmentTxn[] = [],
): Investment[] {
  const snapsBy = new Map<string, InvestmentSnapshot[]>();
  snapshots.forEach((item) => {
    const list = snapsBy.get(item.investment_id) ?? [];
    list.push(item);
    snapsBy.set(item.investment_id, list);
  });
  const txBy = new Map<string, InvestmentTxn[]>();
  transactions.forEach((item) => {
    if (!item.investment_id) return;
    const list = txBy.get(item.investment_id) ?? [];
    list.push(item);
    txBy.set(item.investment_id, list);
  });

  return investments.map((investment) => {
    const snaps = snapsBy.get(investment.id) ?? [];
    const txs = txBy.get(investment.id) ?? [];
    const buyTotal = txs
      .filter((item) => item.type === "BUY")
      .reduce((sum, item) => sum + Math.abs(Number(item.amount ?? 0)), 0);
    const original = Number(investment.amount_original ?? 0) || buyTotal || Number(investment.amount ?? 0);
    const amount = Number(investment.amount ?? 0);
    if (original !== 0 && amount !== 0 && Math.abs(amount - original) >= 0.02) {
      return {
        ...investment,
        amount_original: original,
        amount_profit: Number((amount - original).toFixed(2)),
      };
    }

    const principal = original || amount;
    if (principal === 0) return investment;
    const days = holdingDaysFrom(snaps, txs);
    const monthly = monthlyYieldPercent(investment);
    const profit = Number((principal * (monthly / 100) * (days / 30)).toFixed(2));
    return {
      ...investment,
      amount: Number((principal + profit).toFixed(2)),
      amount_original: principal,
      amount_profit: profit,
      last_month_rate: monthly,
    };
  });
}
