import { createClient } from "@/lib/supabase/server";
import { getFinancialSnapshot } from "@/lib/finance/summary";
import { loadCategoryLimits } from "@/lib/finance/category-budgets-store";
import MetasClient from "@/components/metas/MetasClient";

export const dynamic = "force-dynamic";

export default async function MetasPage() {
  const supabase = await createClient();
  const [snapshot, { data: userData }] = await Promise.all([getFinancialSnapshot(supabase), supabase.auth.getUser()]);
  const categoryLimits = userData.user ? await loadCategoryLimits(userData.user.id) : {};

  return (
    <MetasClient
      initialGoals={snapshot.goals}
      historyTx={snapshot.historyTx}
      initialBudget={snapshot.monthlyBudget}
      initialCategoryLimits={categoryLimits}
    />
  );
}
