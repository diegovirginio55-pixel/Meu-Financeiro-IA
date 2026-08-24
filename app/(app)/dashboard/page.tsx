import { format, startOfMonth, subMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getFinancialSnapshot } from "@/lib/finance/summary";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";
import HomeSwitch from "@/components/home/HomeSwitch";
import type { Transaction } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const from = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");

  const [snapshot, connections, historyRes] = await Promise.all([
    getFinancialSnapshot(supabase),
    getBankConnectionsWithAssets(supabase),
    supabase.from("transactions").select("*").gte("date", from).order("date", { ascending: true }),
  ]);

  return (
    <HomeSwitch
      snapshot={snapshot}
      connections={connections}
      historyTx={(historyRes.data ?? []) as Transaction[]}
    />
  );
}
