import { createClient } from "@/lib/supabase/server";
import BancosClient from "@/components/bancos/BancosClient";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";

export const dynamic = "force-dynamic";

export default async function BancosPage({ searchParams }: { searchParams: Promise<{ banco?: string | string[] }> }) {
  const supabase = await createClient();
  const [connections, params] = await Promise.all([getBankConnectionsWithAssets(supabase), searchParams]);
  // /bancos?banco=<id>: abre direto os detalhes do banco (atalho "Corrigir saldo" da tela inicial).
  const wanted = typeof params.banco === "string" ? params.banco : null;
  const initialSelectedId = connections.some((connection) => connection.id === wanted) ? wanted : null;
  return <BancosClient initialConnections={connections} initialSelectedId={initialSelectedId} />;
}
