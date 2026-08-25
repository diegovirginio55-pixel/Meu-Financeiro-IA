import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncBankConnection } from "@/lib/pluggy/sync";

const SYNC_EVENTS = new Set([
  "item/created",
  "item/updated",
  "item/login_succeeded",
  "transactions/created",
  "transactions/updated",
  "accounts/updated",
  "credit_cards/updated",
  "investments/updated",
]);

/**
 * Endpoint público chamado pela Pluggy sempre que algo muda numa conexão
 * (novo extrato, saldo atualizado, etc). Não tem sessão de usuário, então
 * usa o cliente admin (service role) só para localizar o dono da conexão
 * e gravar nas tabelas dele — nunca fora do escopo do próprio item.
 */
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const event: string | undefined = payload?.event;
  const itemId: string | undefined = payload?.itemId;

  // Sempre responde 200 rápido; a Pluggy reenvia em caso de erro/timeout,
  // e eventos que não exigem sync (pagamentos, etc) não se aplicam aqui.
  if (!event || !itemId || !SYNC_EVENTS.has(event)) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();

  const { data: connection } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("pluggy_item_id", itemId)
    .single();

  if (!connection) {
    return NextResponse.json({ ok: true });
  }

  try {
    await syncBankConnection(supabase, connection.user_id, connection.id, itemId);
  } catch (error) {
    console.error("Erro ao sincronizar via webhook da Pluggy:", error);
  }

  return NextResponse.json({ ok: true });
}
