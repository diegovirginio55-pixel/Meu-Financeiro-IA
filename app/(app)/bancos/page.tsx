import { createClient } from "@/lib/supabase/server";
import BancosClient from "@/components/bancos/BancosClient";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";

export const dynamic = "force-dynamic";

export default async function BancosPage() {
  const supabase = await createClient();
  const connections = await getBankConnectionsWithAssets(supabase);
  return <BancosClient initialConnections={connections} />;
}
