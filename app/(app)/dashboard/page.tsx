import { createClient } from "@/lib/supabase/server";
import { getFinancialSnapshot } from "@/lib/finance/summary";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";
import HomeSwitch from "@/components/home/HomeSwitch";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [snapshot, connections] = await Promise.all([
    getFinancialSnapshot(supabase),
    getBankConnectionsWithAssets(supabase),
  ]);

  return <HomeSwitch snapshot={snapshot} connections={connections} />;
}
