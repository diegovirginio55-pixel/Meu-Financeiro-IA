import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshBankConnections } from "@/lib/pluggy/auto-refresh";
import { publicOrigin } from "@/lib/pluggy/origin";

/**
 * Atualiza os bancos sozinho: pede saldo novo na Pluggy (no máximo 1x por hora)
 * e grava o que já estiver pronto. O webhook completa quando o banco termina.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { pullOnly?: boolean };
  const { data: connections } = await supabase.from("bank_connections").select("*").eq("user_id", user.id);
  if (!connections || connections.length === 0) {
    return NextResponse.json({ pulled: 0, triggered: 0, updated: 0 });
  }

  const origin = publicOrigin(request);
  const result = await refreshBankConnections({
    supabase,
    connections,
    webhookUrl: origin ? `${origin}/api/bank/webhook` : undefined,
    pullOnly: body.pullOnly === true,
  });

  return NextResponse.json({ ...result, updated: result.pulled });
}
