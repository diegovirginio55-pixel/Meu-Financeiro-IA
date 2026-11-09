import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeDeletedPluggyTransactions, syncBankConnectionSafely } from "@/lib/pluggy/sync";
import { verifyWebhookToken } from "@/lib/pluggy/webhook";

/** Eventos que pedem sync completo (inclui investimentos). */
const FULL_SYNC_EVENTS = new Set(["item/created", "item/updated", "item/login_succeeded", "investments/updated"]);

/** Eventos que só mexem em extrato/saldo: sync leve, para o push sair na hora. */
const LIGHT_SYNC_EVENTS = new Set([
  "transactions/created",
  "transactions/updated",
  "accounts/updated",
  "credit_cards/updated",
]);

/**
 * Endpoint público chamado pela Pluggy sempre que algo muda numa conexão.
 *
 * A Pluggy exige resposta 2xx em até 10 s; se demorar, ela só reenvia 15 min
 * depois (e depois 2 h). Antes o sync inteiro rodava ANTES de responder, o
 * que atrasava as notificações. Agora responde na hora e processa em
 * seguida com `after()`.
 *
 * Sem sessão de usuário: usa o cliente admin só para localizar o dono do
 * item e gravar nas tabelas dele.
 */
export async function POST(request: Request) {
  // Cabeçalho com segredo errado = não veio da Pluggy. 401 não é reenviado.
  if (verifyWebhookToken(request) === "invalid") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const event: string | undefined = payload?.event;
  const itemId: string | undefined = payload?.itemId;

  const isDeletion = event === "transactions/deleted";
  if (!event || !itemId || !(FULL_SYNC_EVENTS.has(event) || LIGHT_SYNC_EVENTS.has(event) || isDeletion)) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();
  const { data: connection } = await supabase
    .from("bank_connections")
    .select("id, user_id, pluggy_item_id")
    .eq("pluggy_item_id", itemId)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ ok: true });
  }

  after(async () => {
    try {
      if (isDeletion) {
        const ids = Array.isArray(payload?.transactionIds)
          ? (payload.transactionIds as unknown[]).filter((id): id is string => typeof id === "string")
          : [];
        await removeDeletedPluggyTransactions(supabase, connection.id, ids);
        return;
      }
      await syncBankConnectionSafely(supabase, connection.user_id, connection.id, itemId, {
        investments: FULL_SYNC_EVENTS.has(event),
      });
    } catch (error) {
      console.error(`Erro ao processar webhook da Pluggy (${event}):`, error);
    }
  });

  return NextResponse.json({ ok: true });
}
