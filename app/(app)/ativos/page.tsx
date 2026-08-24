import { createClient } from "@/lib/supabase/server";
import { format, subDays } from "date-fns";
import AtivosClient from "@/components/ativos/AtivosClient";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";
import type { InvestmentSnapshot, InvestmentTxn } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export default async function AtivosPage() {
  const supabase = await createClient();
  const from = format(subDays(new Date(), 45), "yyyy-MM-dd");

  const [connections, snapRes, txRes] = await Promise.all([
    getBankConnectionsWithAssets(supabase),
    supabase.from("investment_snapshots").select("*").gte("snapshot_date", from),
    supabase.from("investment_transactions").select("*").gte("date", from),
  ]);

  return (
    <AtivosClient
      connections={connections}
      snapshots={(snapRes.data ?? []) as InvestmentSnapshot[]}
      investmentTx={(txRes.data ?? []) as InvestmentTxn[]}
    />
  );
}
