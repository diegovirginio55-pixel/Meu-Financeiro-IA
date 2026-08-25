import { eachDayOfInterval, format, startOfMonth, subDays, subMonths } from "date-fns";
import { formatMonthLabel } from "./format";
import type { BankConnection, Investment, InvestmentSnapshot, InvestmentTxn } from "./types";
import { institutionFromAssetName, realConnectionId } from "./connection-filter";
import { officialInstitutionName } from "@/lib/pluggy/brands";

export type DailyPnlPoint = {
  date: string;
  label: string;
  Total: number;
  [bank: string]: number | string;
};

export type PnlSeriesKey = {
  key: string;
  label: string;
};

export type AssetPnlRow = {
  key: string;
  label: string;
  amount: number;
  today: number;
  d7: number;
  d30: number;
  accumulated: number;
  rate: number | null;
  estimated: boolean;
};

export type YieldPoint = {
  date: string;
  label: string;
  lucro: number;
  capital: number;
  rendimento: number;
};

function toDateKey(value: string): string {
  return value.slice(0, 10);
}

function shortInvestmentLabel(name: string): string {
  const cleaned = name.replace(/^[^·•\-]+[·•\-]\s*/, "").trim() || name;
  return cleaned.length > 28 ? `${cleaned.slice(0, 26)}…` : cleaned;
}

function addTo(daily: Map<string, Map<string, number>>, date: string, key: string, value: number) {
  if (!Number.isFinite(value) || value === 0) return;
  if (!daily.has(date)) daily.set(date, new Map());
  const row = daily.get(date)!;
  row.set(key, (row.get(key) ?? 0) + value);
}

function estimatedDailyProfit(investment: Investment, days: number): number {
  const amount = Number(investment.amount ?? 0);
  const rate = Number(investment.last_month_rate ?? 0);
  if (rate !== 0 && amount !== 0) {
    return (amount * (rate / 100)) / 30;
  }
  const profit = Number(investment.amount_profit ?? 0);
  if (profit !== 0) return profit / Math.max(days, 1);
  const original = Number(investment.amount_original ?? 0);
  if (amount !== 0 && original !== 0 && amount !== original) {
    return (amount - original) / Math.max(days, 1);
  }
  return 0;
}

function eligibleInvestments(investments: Investment[], snapshots: InvestmentSnapshot[]): Investment[] {
  const withSnapshot = new Set(snapshots.map((item) => item.investment_id));
  return investments.filter(
    (item) =>
      Number(item.amount) !== 0 ||
      Number(item.amount_profit ?? 0) !== 0 ||
      Number(item.amount_original ?? 0) !== 0 ||
      withSnapshot.has(item.id),
  );
}

function snapshotsByInvestment(snapshots: InvestmentSnapshot[]) {
  const map = new Map<string, InvestmentSnapshot[]>();
  snapshots.forEach((item) => {
    const list = map.get(item.investment_id) ?? [];
    list.push(item);
    map.set(item.investment_id, list);
  });
  map.forEach((list) => list.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)));
  return map;
}

function diffSnapshots(
  list: InvestmentSnapshot[],
  field: "amount_profit" | "amount",
): Array<{ date: string; value: number }> {
  const points: Array<{ date: string; value: number }> = [];
  for (let i = 1; i < list.length; i += 1) {
    const prevValue = list[i - 1][field];
    const currentValue = list[i][field];
    if (field === "amount_profit" && (prevValue == null || currentValue == null)) continue;
    points.push({
      date: toDateKey(list[i].snapshot_date),
      value: Number(currentValue ?? 0) - Number(prevValue ?? 0),
    });
  }
  return points;
}

function seriesForInvestment({
  investment,
  snapshots,
  interest,
  interval,
  days,
}: {
  investment: Investment;
  snapshots: InvestmentSnapshot[];
  interest: InvestmentTxn[];
  interval: Date[];
  days: number;
}): { points: Array<{ date: string; value: number }>; estimated: boolean } {
  const profitSnaps = snapshots.filter((item) => item.amount_profit != null);
  if (profitSnaps.length >= 2) {
    return { points: diffSnapshots(profitSnaps, "amount_profit"), estimated: false };
  }

  if (interest.length > 0) {
    return {
      points: interest.map((item) => ({ date: toDateKey(item.date), value: Number(item.amount) })),
      estimated: false,
    };
  }

  if (snapshots.length >= 2) {
    return { points: diffSnapshots(snapshots, "amount"), estimated: false };
  }

  const perDay = estimatedDailyProfit(investment, Math.min(days, 30));
  if (perDay === 0) return { points: [], estimated: false };

  const last = interval[interval.length - 1] ?? new Date();
  const estimateFrom = format(subDays(last, 29), "yyyy-MM-dd");
  return {
    points: interval
      .filter((day) => format(day, "yyyy-MM-dd") >= estimateFrom)
      .map((day) => ({ date: format(day, "yyyy-MM-dd"), value: perDay })),
    estimated: true,
  };
}

function toSeries(
  interval: Date[],
  keys: PnlSeriesKey[],
  daily: Map<string, Map<string, number>>,
): DailyPnlPoint[] {
  return interval.map((day) => {
    const date = format(day, "yyyy-MM-dd");
    const row: DailyPnlPoint = { date, label: format(day, "dd/MM"), Total: 0 };
    keys.forEach((item) => {
      const value = daily.get(date)?.get(item.key) ?? 0;
      row[item.key] = Number(value.toFixed(2));
      row.Total += Number(value);
    });
    row.Total = Number(row.Total.toFixed(2));
    return row;
  });
}

export function buildDailyInvestmentPnlByAsset({
  investments,
  snapshots,
  transactions,
  days = 30,
}: {
  investments: Investment[];
  snapshots: InvestmentSnapshot[];
  transactions: InvestmentTxn[];
  days?: number;
}): { series: DailyPnlPoint[]; keys: PnlSeriesKey[]; estimated: boolean; estimatedIds: string[] } {
  const eligible = eligibleInvestments(investments, snapshots);
  const knownIds = new Set(eligible.map((item) => item.id));
  const end = new Date();
  const start = subDays(end, days - 1);
  const interval = eachDayOfInterval({ start, end });
  const byInvestment = snapshotsByInvestment(snapshots);
  const interestByInvestment = new Map<string, InvestmentTxn[]>();
  transactions
    .filter((item) => item.type === "INTEREST" && item.investment_id && knownIds.has(item.investment_id))
    .forEach((item) => {
      const list = interestByInvestment.get(item.investment_id!) ?? [];
      list.push(item);
      interestByInvestment.set(item.investment_id!, list);
    });

  const daily = new Map<string, Map<string, number>>();
  const estimatedIds: string[] = [];

  eligible.forEach((investment) => {
    const { points, estimated } = seriesForInvestment({
      investment,
      snapshots: byInvestment.get(investment.id) ?? [],
      interest: interestByInvestment.get(investment.id) ?? [],
      interval,
      days,
    });
    if (estimated) estimatedIds.push(investment.id);
    points.forEach((point) => addTo(daily, point.date, investment.id, point.value));
  });

  const series = toSeries(
    interval,
    eligible.map((item) => ({ key: item.id, label: shortInvestmentLabel(item.name) })),
    daily,
  );

  const keys = eligible
    .map((item) => ({
      key: item.id,
      label: shortInvestmentLabel(item.name),
      score: Math.abs(sumKey(series, item.id)),
      amount: Number(item.amount ?? 0),
    }))
    .sort((a, b) => b.score - a.score || b.amount - a.amount)
    .map(({ key, label }) => ({ key, label }));

  return { series, keys, estimated: estimatedIds.length > 0, estimatedIds };
}

export function buildDailyInvestmentPnl({
  connections,
  investments,
  snapshots,
  transactions,
  days = 30,
}: {
  connections: BankConnection[];
  investments: Investment[];
  snapshots: InvestmentSnapshot[];
  transactions: InvestmentTxn[];
  days?: number;
}): { series: DailyPnlPoint[]; banks: string[]; estimated: boolean } {
  const fallbackByConnection = (connectionId: string | null) => {
    const connection = connections.find(
      (item) => item.id === connectionId || realConnectionId(item.id) === connectionId,
    );
    return officialInstitutionName(connection?.institution_name ?? "Outros");
  };

  const bankOfInvestment = (investment: Investment) =>
    institutionFromAssetName(investment.name, fallbackByConnection(investment.bank_connection_id ?? null));

  const byAsset = buildDailyInvestmentPnlByAsset({ investments, snapshots, transactions, days });
  const idToBank = new Map(investments.map((item) => [item.id, bankOfInvestment(item)]));
  const banks = Array.from(
    new Set(
      [
        ...investments.map((item) => bankOfInvestment(item)),
        ...byAsset.keys.map((item) => idToBank.get(item.key)).filter(Boolean),
      ].filter((name): name is string => Boolean(name)),
    ),
  );

  const end = new Date();
  const start = subDays(end, days - 1);
  const interval = eachDayOfInterval({ start, end });
  const daily = new Map<string, Map<string, number>>();

  byAsset.series.forEach((point) => {
    byAsset.keys.forEach((item) => {
      const bank = idToBank.get(item.key);
      if (!bank) return;
      addTo(daily, point.date, bank, Number(point[item.key] ?? 0));
    });
  });

  return {
    series: toSeries(
      interval,
      banks.map((bank) => ({ key: bank, label: bank })),
      daily,
    ),
    banks,
    estimated: byAsset.estimated,
  };
}

function sumKey(series: DailyPnlPoint[], key: string, lastN?: number): number {
  const slice = lastN ? series.slice(-lastN) : series;
  return Number(slice.reduce((sum, point) => sum + Number(point[key] ?? 0), 0).toFixed(2));
}

export function summarizeAssetPnl(
  series: DailyPnlPoint[],
  keys: PnlSeriesKey[],
  investments: Investment[],
  estimatedIds: string[] = [],
): AssetPnlRow[] {
  const last = series[series.length - 1];
  const estimated = new Set(estimatedIds);
  return keys
    .map((item) => {
      const investment = investments.find((row) => row.id === item.key);
      return {
        key: item.key,
        label: item.label,
        amount: Number(investment?.amount ?? 0),
        today: Number(last?.[item.key] ?? 0),
        d7: sumKey(series, item.key, 7),
        d30: sumKey(series, item.key),
        accumulated: Number(investment?.amount_profit ?? 0),
        rate: investment?.last_month_rate == null ? null : Number(investment.last_month_rate),
        estimated: estimated.has(item.key),
      };
    })
    .sort((a, b) => Math.abs(b.d30) - Math.abs(a.d30) || b.amount - a.amount);
}

export function totalAccumulatedProfit(investments: Investment[]): number {
  return investments.reduce((sum, item) => sum + Number(item.amount_profit ?? 0), 0);
}

function runningCapitalByDate(
  investments: Investment[],
  snapshots: InvestmentSnapshot[],
  dates: string[],
): Map<string, number> {
  const totals = new Map<string, number>(dates.map((date) => [date, 0]));
  if (dates.length === 0) return totals;

  const byInvestment = snapshotsByInvestment(snapshots);
  const firstDate = dates[0];

  investments.forEach((investment) => {
    const snaps = byInvestment.get(investment.id) ?? [];
    let amount = Number(investment.amount ?? 0);
    if (snaps.length > 0) {
      const before = snaps.filter((item) => toDateKey(item.snapshot_date) < firstDate);
      if (before.length > 0) amount = Number(before[before.length - 1].amount);
      else amount = Number(snaps[0].amount ?? amount);
    }
    let index = 0;
    dates.forEach((date) => {
      while (index < snaps.length && toDateKey(snaps[index].snapshot_date) <= date) {
        amount = Number(snaps[index].amount);
        index += 1;
      }
      totals.set(date, (totals.get(date) ?? 0) + amount);
    });
  });

  return totals;
}

function toYieldPoints(series: DailyPnlPoint[], capitalByDate: Map<string, number>): YieldPoint[] {
  return series.map((point) => {
    const lucro = Number(point.Total);
    const capital = capitalByDate.get(point.date) ?? 0;
    return {
      date: point.date,
      label: point.label,
      lucro: Number(lucro.toFixed(2)),
      capital: Number(capital.toFixed(2)),
      rendimento: capital > 0 ? Number(((lucro / capital) * 100).toFixed(4)) : 0,
    };
  });
}

export function buildDailyYieldSeries(
  series: DailyPnlPoint[],
  investments: Investment[],
  snapshots: InvestmentSnapshot[],
): YieldPoint[] {
  const dates = series.map((point) => point.date);
  return toYieldPoints(series, runningCapitalByDate(investments, snapshots, dates));
}

export function periodYield(points: YieldPoint[]): number {
  if (points.length === 0) return 0;
  const lucro = points.reduce((sum, point) => sum + point.lucro, 0);
  const capital = points[points.length - 1]?.capital ?? 0;
  if (capital <= 0) return 0;
  return Number(((lucro / capital) * 100).toFixed(4));
}

export function buildMonthlyInvestmentYield({
  investments,
  snapshots,
  transactions,
  months = 12,
}: {
  investments: Investment[];
  snapshots: InvestmentSnapshot[];
  transactions: InvestmentTxn[];
  months?: number;
}): { series: YieldPoint[]; estimated: boolean } {
  const end = new Date();
  const start = startOfMonth(subMonths(end, months - 1));
  const interval = eachDayOfInterval({ start, end });
  const daily = buildDailyInvestmentPnlByAsset({
    investments,
    snapshots,
    transactions,
    days: interval.length,
  });
  const dailyYield = buildDailyYieldSeries(daily.series, investments, snapshots);
  const byMonth = new Map<string, { lucro: number; capital: number; days: number }>();

  dailyYield.forEach((point) => {
    const month = point.date.slice(0, 7);
    const row = byMonth.get(month) ?? { lucro: 0, capital: 0, days: 0 };
    row.lucro += point.lucro;
    row.capital += point.capital;
    row.days += 1;
    byMonth.set(month, row);
  });

  const series: YieldPoint[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = format(startOfMonth(subMonths(end, i)), "yyyy-MM");
    const row = byMonth.get(date);
    const capital = row && row.days > 0 ? row.capital / row.days : 0;
    const lucro = row?.lucro ?? 0;
    series.push({
      date,
      label: formatMonthLabel(date),
      lucro: Number(lucro.toFixed(2)),
      capital: Number(capital.toFixed(2)),
      rendimento: capital > 0 ? Number(((lucro / capital) * 100).toFixed(4)) : 0,
    });
  }

  return { series, estimated: daily.estimated };
}
