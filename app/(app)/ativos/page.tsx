import { createClient } from "@/lib/supabase/server";
import AtivosClient from "@/components/ativos/AtivosClient";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";
import { lastNMonthKeys } from "@/lib/finance/fluxo";
import type { InvestmentSnapshot, InvestmentTxn } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export default async function AtivosPage() {
  const supabase = await createClient();
  const from = `${lastNMonthKeys(12)[0]}-01`;
  const connections = await getBankConnectionsWithAssets(supabase);
  const [snapRes, txRes] = await Promise.all([
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
