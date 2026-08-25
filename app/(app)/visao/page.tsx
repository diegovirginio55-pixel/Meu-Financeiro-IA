import { format, startOfMonth, subMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getFinancialSnapshot } from "@/lib/finance/summary";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";
import DashboardClient from "@/components/dashboard/DashboardClient";
import type { InvestmentSnapshot, InvestmentTxn, Transaction } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export default async function VisaoPage() {
  const supabase = await createClient();
  const from = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");

  const [snapshot, connections, historyRes, snapRes, txRes] = await Promise.all([
    getFinancialSnapshot(supabase),
    getBankConnectionsWithAssets(supabase),
    supabase.from("transactions").select("*").gte("date", from).order("date", { ascending: true }),
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
