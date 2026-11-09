import { createClient } from "@/lib/supabase/server";
import { getFinancialSnapshot } from "@/lib/finance/summary";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";
import { lastNMonthKeys } from "@/lib/finance/fluxo";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import DashboardClient from "@/components/dashboard/DashboardClient";
import type { InvestmentSnapshot, InvestmentTxn, Transaction } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export default async function VisaoPage() {
  const supabase = await createClient();
  const from = `${lastNMonthKeys(12)[0]}-01`;

  const [snapshot, connections, historyRes, snapRes, txRes] = await Promise.all([
    getFinancialSnapshot(supabase),
    getBankConnectionsWithAssets(supabase),
    // Paginado: em ordem crescente, o corte de 1000 linhas descartava
    // justamente os lançamentos mais recentes (mês atual zerado).
    fetchAllRows<Transaction>((start, end) =>
      supabase
        .from("transactions")
        .select("*")
        .gte("date", from)
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(start, end),
    ),
    supabase.from("investment_snapshots").select("*").gte("snapshot_date", from),
    supabase.from("investment_transactions").select("*").gte("date", from),
  ]);

  return (
    <DashboardClient
      snapshot={snapshot}
      connections={connections}
      historyTx={(historyRes.data ?? []) as Transaction[]}
      snapshots={(snapRes.data ?? []) as InvestmentSnapshot[]}
      investmentTx={(txRes.data ?? []) as InvestmentTxn[]}
    />
  );
}
