import { eachDayOfInterval, format, subDays } from "date-fns";
import type { BankConnection, Investment, InvestmentSnapshot, InvestmentTxn } from "./types";
import { institutionFromAssetName, realConnectionId } from "./connection-filter";
import { officialInstitutionName } from "@/lib/pluggy/brands";

export type DailyPnlPoint = {
  date: string;
  label: string;
  Total: number;
  [bank: string]: number | string;
};

function toDateKey(value: string): string {
  return value.slice(0, 10);
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

  const bankName = (connectionId: string | null, investmentId?: string | null) => {
    const investment = investments.find((item) => item.id === investmentId);
    if (investment) return bankOfInvestment(investment);
    return fallbackByConnection(connectionId);
  };

  const banks = Array.from(
    new Set(
      [
        ...investments.map((item) => bankOfInvestment(item)),
        ...snapshots.map((item) => bankName(item.bank_connection_id, item.investment_id)),
        ...transactions.map((item) => bankName(item.bank_connection_id, item.investment_id)),
      ].filter(Boolean),
    ),
  );

  const end = new Date();
  const start = subDays(end, days - 1);
  const interval = eachDayOfInterval({ start, end });

  const interest = transactions.filter((item) => item.type === "INTEREST");
  const snapshotDays = new Set(snapshots.map((item) => toDateKey(item.snapshot_date))).size;
  const canDiffSnapshots = snapshotDays >= 2;

  const byInvestment = new Map<string, InvestmentSnapshot[]>();
  snapshots.forEach((item) => {
    const list = byInvestment.get(item.investment_id) ?? [];
    list.push(item);
    byInvestment.set(item.investment_id, list);
  });

  const daily = new Map<string, Map<string, number>>();
  function add(date: string, bank: string, value: number) {
    if (!daily.has(date)) daily.set(date, new Map());
    const row = daily.get(date)!;
    row.set(bank, (row.get(bank) ?? 0) + value);
  }

  const hasProfitHistory = canDiffSnapshots && snapshots.some((item) => item.amount_profit != null);

  if (hasProfitHistory) {
    byInvestment.forEach((list) => {
      const ordered = [...list].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
      for (let i = 1; i < ordered.length; i += 1) {
        const prev = Number(ordered[i - 1].amount_profit ?? 0);
        const current = Number(ordered[i].amount_profit ?? 0);
        add(toDateKey(ordered[i].snapshot_date), bankName(ordered[i].bank_connection_id, ordered[i].investment_id), current - prev);
      }
    });
  } else if (interest.length > 0) {
    interest.forEach((item) => {
      add(toDateKey(item.date), bankName(item.bank_connection_id, item.investment_id), Number(item.amount));
    });
  } else if (canDiffSnapshots) {
    byInvestment.forEach((list) => {
      const ordered = [...list].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
      for (let i = 1; i < ordered.length; i += 1) {
        const prev = Number(ordered[i - 1].amount);
        const current = Number(ordered[i].amount);
        add(toDateKey(ordered[i].snapshot_date), bankName(ordered[i].bank_connection_id, ordered[i].investment_id), current - prev);
      }
    });
  }

  let estimated = false;
  const hasDaily = Array.from(daily.values()).some((row) => Array.from(row.values()).some((value) => value !== 0));
  if (!hasDaily && !canDiffSnapshots) {
    estimated = true;
    investments.forEach((investment) => {
      const rate = Number(investment.last_month_rate ?? 0);
      const profit = Number(investment.amount_profit ?? 0);
      const perDay =
        rate !== 0
          ? (Number(investment.amount) * (rate / 100)) / 30
          : profit !== 0
            ? profit / days
            : 0;
      if (perDay === 0) return;
      const bank = bankOfInvestment(investment);
      interval.forEach((day) => add(format(day, "yyyy-MM-dd"), bank, perDay));
    });
  }

  const series: DailyPnlPoint[] = interval.map((day) => {
    const date = format(day, "yyyy-MM-dd");
    const row: DailyPnlPoint = {
      date,
      label: format(day, "dd/MM"),
      Total: 0,
    };
    banks.forEach((bank) => {
      const value = daily.get(date)?.get(bank) ?? 0;
      row[bank] = Number(value.toFixed(2));
      row.Total += Number(value);
    });
    row.Total = Number(row.Total.toFixed(2));
    return row;
  });

  return { series, banks, estimated: estimated && !hasDaily };
}

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
};

function shortInvestmentLabel(name: string): string {
  const cleaned = name.replace(/^[^·•\-]+[·•\-]\s*/, "").trim() || name;
  return cleaned.length > 28 ? `${cleaned.slice(0, 26)}…` : cleaned;
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
}): { series: DailyPnlPoint[]; keys: PnlSeriesKey[]; estimated: boolean } {
  const keys: PnlSeriesKey[] = investments
    .filter((item) => Number(item.amount) !== 0 || Number(item.amount_profit ?? 0) !== 0)
    .map((item) => ({ key: item.id, label: shortInvestmentLabel(item.name) }));

  const knownIds = new Set(keys.map((item) => item.key));
  const end = new Date();
  const start = subDays(end, days - 1);
  const interval = eachDayOfInterval({ start, end });

  const interest = transactions.filter((item) => item.type === "INTEREST" && item.investment_id);
  const snapshotDays = new Set(snapshots.map((item) => toDateKey(item.snapshot_date))).size;
  const canDiffSnapshots = snapshotDays >= 2;

  const byInvestment = new Map<string, InvestmentSnapshot[]>();
  snapshots.forEach((item) => {
    if (!knownIds.has(item.investment_id)) return;
    const list = byInvestment.get(item.investment_id) ?? [];
    list.push(item);
    byInvestment.set(item.investment_id, list);
  });

  const daily = new Map<string, Map<string, number>>();
  function add(date: string, key: string, value: number) {
    if (!knownIds.has(key)) return;
    if (!daily.has(date)) daily.set(date, new Map());
    const row = daily.get(date)!;
    row.set(key, (row.get(key) ?? 0) + value);
  }

  const hasProfitHistory = canDiffSnapshots && snapshots.some((item) => item.amount_profit != null);

  if (hasProfitHistory) {
    byInvestment.forEach((list, investmentId) => {
      const ordered = [...list].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
      for (let i = 1; i < ordered.length; i += 1) {
        const prev = Number(ordered[i - 1].amount_profit ?? 0);
        const current = Number(ordered[i].amount_profit ?? 0);
        add(toDateKey(ordered[i].snapshot_date), investmentId, current - prev);
      }
    });
  } else if (interest.length > 0) {
    interest.forEach((item) => {
      if (item.investment_id) add(toDateKey(item.date), item.investment_id, Number(item.amount));
    });
  } else if (canDiffSnapshots) {
    byInvestment.forEach((list, investmentId) => {
      const ordered = [...list].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
      for (let i = 1; i < ordered.length; i += 1) {
        add(
          toDateKey(ordered[i].snapshot_date),
          investmentId,
          Number(ordered[i].amount) - Number(ordered[i - 1].amount),
        );
      }
    });
  }

  let estimated = false;
  const hasDaily = Array.from(daily.values()).some((row) => Array.from(row.values()).some((value) => value !== 0));
  if (!hasDaily && !canDiffSnapshots) {
    estimated = true;
    investments.forEach((investment) => {
      if (!knownIds.has(investment.id)) return;
      const rate = Number(investment.last_month_rate ?? 0);
      const profit = Number(investment.amount_profit ?? 0);
      const perDay =
        rate !== 0
          ? (Number(investment.amount) * (rate / 100)) / 30
          : profit !== 0
            ? profit / days
            : 0;
      if (perDay === 0) return;
      interval.forEach((day) => add(format(day, "yyyy-MM-dd"), investment.id, perDay));
    });
  }

  const series: DailyPnlPoint[] = interval.map((day) => {
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

  return { series, keys, estimated: estimated && !hasDaily };
}

function sumKey(series: DailyPnlPoint[], key: string, lastN?: number): number {
  const slice = lastN ? series.slice(-lastN) : series;
  return Number(slice.reduce((sum, point) => sum + Number(point[key] ?? 0), 0).toFixed(2));
}

export function summarizeAssetPnl(
  series: DailyPnlPoint[],
  keys: PnlSeriesKey[],
  investments: Investment[],
): AssetPnlRow[] {
  const last = series[series.length - 1];
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
      };
    })
    .sort((a, b) => Math.abs(b.d30) - Math.abs(a.d30) || b.amount - a.amount);
}

export function totalAccumulatedProfit(investments: Investment[]): number {
  return investments.reduce((sum, item) => sum + Number(item.amount_profit ?? 0), 0);
}
