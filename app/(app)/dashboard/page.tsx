import { createClient } from "@/lib/supabase/server";
import { getFinancialSnapshot } from "@/lib/finance/summary";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";
import { saoPauloWeekStartKey } from "@/lib/finance/fluxo";
import HomeSwitch from "@/components/home/HomeSwitch";
import type { Transaction } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [snapshot, connections, historyRes] = await Promise.all([
    getFinancialSnapshot(supabase),
    getBankConnectionsWithAssets(supabase),
    supabase.from("transactions").select("*").gte("date", saoPauloWeekStartKey()),
  ]);

  return (
    <HomeSwitch
      snapshot={snapshot}
      connections={connections}
      historyTx={(historyRes.data ?? []) as Transaction[]}
    />
  );
}
