import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ingestTokenFor } from "@/lib/ingest/token";
import { readIngestLog } from "@/lib/ingest/log";
import { publicOrigin } from "@/lib/pluggy/origin";
import RealTimeSetupClient from "@/components/bancos/RealTimeSetupClient";

export const dynamic = "force-dynamic";

/** Configuração do "Saldo em tempo real": notificações do banco encaminhadas pelo celular. */
export default async function TempoRealPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const [token, log] = userId ? await Promise.all([ingestTokenFor(userId), readIngestLog(userId)]) : [null, []];

  const requestHeaders = await headers();
  const origin =
    publicOrigin(new Request("https://local", { headers: requestHeaders })) ?? "https://meu-financeiro-ia.onrender.com";

  return <RealTimeSetupClient endpoint={`${origin}/api/ingest/notification`} initialToken={token} log={log} />;
}
