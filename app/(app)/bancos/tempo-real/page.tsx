import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ingestTokenFor } from "@/lib/ingest/token";
import { publicOrigin } from "@/lib/pluggy/origin";
import RealTimeSetupClient from "@/components/bancos/RealTimeSetupClient";

export const dynamic = "force-dynamic";

/** Configuração do "Saldo em tempo real": notificações do banco encaminhadas pelo celular. */
export default async function TempoRealPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const token = userData.user ? await ingestTokenFor(userData.user.id) : null;

  const requestHeaders = await headers();
  const origin =
    publicOrigin(new Request("https://local", { headers: requestHeaders })) ?? "https://meu-financeiro-ia.onrender.com";

  return <RealTimeSetupClient endpoint={`${origin}/api/ingest/notification`} initialToken={token} />;
}
