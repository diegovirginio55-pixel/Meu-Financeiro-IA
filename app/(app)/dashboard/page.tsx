import { format, startOfMonth, subMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getFinancialSnapshot } from "@/lib/finance/summary";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";
import BankHome from "@/components/home/BankHome";
import DashboardClient from "@/components/dashboard/DashboardClient";
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

  const historyTx = (historyRes.data ?? []) as Transaction[];

  return (
    <>
      <div className="md:hidden">
        <BankHome snapshot={snapshot} connections={connections} />
      </div>
      <div className="hidden md:block">
        <DashboardClient snapshot={snapshot} connections={connections} historyTx={historyTx} />
      </div>
    </>
  );
}
