import { createClient } from "@/lib/supabase/server";
import { getFinancialSnapshot } from "@/lib/finance/summary";
import MesClient from "@/components/mes/MesClient";

export const dynamic = "force-dynamic";

export default async function MesPage() {
  const supabase = await createClient();
  const snapshot = await getFinancialSnapshot(supabase);

  return <MesClient snapshot={snapshot} />;
}
