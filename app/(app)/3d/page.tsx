import { createClient } from "@/lib/supabase/server";
import Visao3DClient from "@/components/visao3d/Visao3DClient";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";
import { dailyBalanceHistory, type BalanceSnapshotRow } from "@/lib/finance/balance-history";
import { saoPauloMonthKey, saoPauloTodayKey, shiftMonthKey } from "@/lib/finance/fluxo";
import {
  MONTHS_BACK,
  groupBalanceByMonth,
  monthOptions,
  parseMonthParam,
  parseVista,
  summarizeMonthSpending,
} from "@/lib/finance/visao3d";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { Transaction } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

function monthBounds(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${monthKey}-01`, end: `${monthKey}-${String(lastDay).padStart(2, "0")}` };
}

function shiftDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Visão 3D: gastos do mês e saldo dos últimos 12 meses em cenas 3D. ?mes=AAAA-MM&vista=<aba> */
export default async function Visao3DPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[]; vista?: string | string[] }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const currentMonth = saoPauloMonthKey();
  const todayKey = saoPauloTodayKey();
  const monthKey = parseMonthParam(params.mes, currentMonth);
  const vista = parseVista(params.vista);
  const { start, end } = monthBounds(monthKey);
  // Montanha: do 1º dia de 11 meses atrás até hoje; um mês antes só para
  // começar com o último saldo de cada conta.
  const historyStart = `${shiftMonthKey(currentMonth, -(MONTHS_BACK - 1))}-01`;
  const historyFrom = shiftDays(historyStart, -31);

  const [txRes, snapRes, connections] = await Promise.all([
    fetchAllRows<Transaction>((from, to) =>
      supabase
        .from("transactions")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<BalanceSnapshotRow>((from, to) =>
      supabase
        .from("account_balance_snapshots")
        .select("account_id, snapshot_date, balance")
        .gte("snapshot_date", historyFrom)
        .lte("snapshot_date", todayKey)
        .order("snapshot_date", { ascending: true })
        .order("account_id", { ascending: true })
        .range(from, to),
    ),
    getBankConnectionsWithAssets(supabase),
  ]);

  const spending = summarizeMonthSpending(txRes.data, monthKey);
  const accounts = connections.flatMap((connection) => connection.accounts);
  const accountBalance = accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const balanceMonths = groupBalanceByMonth(dailyBalanceHistory(snapRes.data, historyStart, todayKey));

  const warnings: string[] = [];
  if (txRes.error) warnings.push("Não foi possível carregar todos os lançamentos do mês.");
  if (snapRes.error) warnings.push("Não foi possível carregar o histórico do saldo.");

  return (
    <Visao3DClient
      initialVista={vista}
      monthKey={monthKey}
      months={monthOptions(currentMonth)}
      spending={spending}
      accountBalance={Math.round(accountBalance * 100) / 100}
      hasAccounts={accounts.length > 0}
      balanceMonths={balanceMonths}
      warnings={warnings}
    />
  );
}
