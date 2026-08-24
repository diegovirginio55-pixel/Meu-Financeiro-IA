import { createClient } from "@/lib/supabase/server";
import AtivosClient from "@/components/ativos/AtivosClient";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";

export const dynamic = "force-dynamic";

export default async function AtivosPage() {
  const supabase = await createClient();
  const connections = await getBankConnectionsWithAssets(supabase);
  return <AtivosClient connections={connections} />;
}
