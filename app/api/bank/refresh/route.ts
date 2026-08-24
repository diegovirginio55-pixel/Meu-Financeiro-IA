import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncBankConnection } from "@/lib/pluggy/sync";

const STALE_MS = 30 * 60 * 1000;

/**
 * Atualiza no banco as contas já conectadas, sem o usuário clicar em sincronizar.
 * Só relê o que a Pluggy já tem; não cria conexão nova.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: connections } = await supabase.from("bank_connections").select("*").eq("user_id", user.id);
  if (!connections || connections.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  let updated = 0;

  for (const connection of connections) {
    const last = connection.last_synced_at ? new Date(connection.last_synced_at).getTime() : 0;
    if (last && Date.now() - last < STALE_MS) continue;

    try {
      await syncBankConnection(supabase, user.id, connection.id, connection.pluggy_item_id);
      updated += 1;
    } catch (error) {
      console.error("Erro ao atualizar conexão bancária automaticamente:", error);
    }
  }

  return NextResponse.json({ updated });
}
