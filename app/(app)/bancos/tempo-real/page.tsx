import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ingestTokenFor } from "@/lib/ingest/token";
import { readIngestLog } from "@/lib/ingest/log";
import { phoneView, readPhoneStatus } from "@/lib/ingest/phone-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicOrigin } from "@/lib/pluggy/origin";
import RealTimeSetupClient from "@/components/bancos/RealTimeSetupClient";

export const dynamic = "force-dynamic";

/** Configuração do "Saldo em tempo real": notificações do banco encaminhadas pelo celular. */
export default async function TempoRealPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const [token, log, status] = userId
    ? await Promise.all([ingestTokenFor(userId), readIngestLog(userId), readPhoneStatus(createAdminClient(), userId)])
    : [null, [], null];
  // Estado do app Android (calculado no servidor: "há quanto tempo" depende da hora).
  const phone = phoneView(status);

  const requestHeaders = await headers();
  const origin =
    publicOrigin(new Request("https://local", { headers: requestHeaders })) ?? "https://meu-financeiro-ia.onrender.com";

  return <RealTimeSetupClient endpoint={`${origin}/api/ingest/notification`} initialToken={token} log={log} phone={phone} />;
}

