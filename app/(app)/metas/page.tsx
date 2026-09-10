import { createClient } from "@/lib/supabase/server";
import { getFinancialSnapshot } from "@/lib/finance/summary";
import MetasClient from "@/components/metas/MetasClient";

export const dynamic = "force-dynamic";

export default async function MetasPage() {
  const supabase = await createClient();
  const snapshot = await getFinancialSnapshot(supabase);

  return <MetasClient initialGoals={snapshot.goals} historyTx={snapshot.historyTx} />;
}
