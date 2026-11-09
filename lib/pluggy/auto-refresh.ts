import type { SupabaseClient } from "@supabase/supabase-js";
import { pluggyApi } from "./client";
import { syncBankConnectionSafely } from "./sync";
import { isMissingSchemaError } from "@/lib/supabase/schema-compat";

/** Releitura dos dados que a Pluggy já tem (rede de segurança se um webhook se perder). */
const PULL_STALE_MS = 10 * 60 * 1000;
/** Pedido para a Pluggy buscar dados novos no banco (limite de frequência da Pluggy). */
const TRIGGER_STALE_MS = 60 * 60 * 1000;

type ConnectionRow = {
  id: string;
  user_id: string;
  pluggy_item_id: string;
  last_synced_at: string | null;
  last_triggered_at?: string | null;
};

function ageOf(timestamp: string | null | undefined): number {
  if (!timestamp) return Number.POSITIVE_INFINITY;
  return Date.now() - new Date(timestamp).getTime();
}

/**
 * Erros esperados ao pedir atualização: limite de frequência, item já
 * atualizando, login pendente — e itens do Meu Pluggy, que só atualizam
 * sozinhos (1x por dia) e recusam pedido manual.
 */
function ignorableTriggerError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /BEFORE_ALLOWED_FREQUENCY|ITEM_ALREADY_UPDATING|ITEM_IS_ALREADY_UPDATING|LOGIN_ERROR|WAITING_USER_INPUT|cant be updated|can't be updated|cannot be updated/i.test(
    message,
  );
}

async function markTriggered(supabase: SupabaseClient, connectionId: string) {
  const { error } = await supabase
    .from("bank_connections")
    .update({ last_triggered_at: new Date().toISOString() })
    .eq("id", connectionId);
  if (error && !isMissingSchemaError(error)) console.error("Erro ao registrar pedido de atualização:", error);
}

export async function refreshBankConnections({
  supabase,
  connections,
  webhookUrl,
  pullOnly = false,
}: {
  supabase: SupabaseClient;
  connections: ConnectionRow[];
  webhookUrl?: string;
  pullOnly?: boolean;
}): Promise<{ pulled: number; triggered: number; failed: number }> {
  let pulled = 0;
  let triggered = 0;
  let failed = 0;

  for (const connection of connections) {
    if (!connection.pluggy_item_id) continue;
    const pullAge = ageOf(connection.last_synced_at);
    // Antes o "pedir atualização" usava a idade do último pull, que o cron
    // renovava a cada 10 min — então a idade nunca chegava a 60 min e o
    // pedido nunca saía. Agora cada coisa tem seu próprio relógio.
    const triggerAge =
      connection.last_triggered_at === undefined ? pullAge : ageOf(connection.last_triggered_at);
    const shouldTrigger = !pullOnly && triggerAge >= TRIGGER_STALE_MS;
    const shouldPull = pullOnly || shouldTrigger || pullAge >= PULL_STALE_MS;
    if (!shouldPull) continue;

    if (shouldTrigger) {
      try {
        await pluggyApi.patchItem(connection.pluggy_item_id, webhookUrl ? { webhookUrl } : {});
        triggered += 1;
      } catch (error) {
        if (!ignorableTriggerError(error)) {
          console.error("Erro ao pedir atualização na Pluggy:", error);
        }
      }
      // Marca mesmo se a Pluggy recusou, para não insistir a cada execução.
      await markTriggered(supabase, connection.id);
    }

    try {
      await syncBankConnectionSafely(supabase, connection.user_id, connection.id, connection.pluggy_item_id);
      pulled += 1;
    } catch (error) {
      failed += 1;
      console.error("Erro ao puxar saldo da Pluggy:", error);
    }
  }

  return { pulled, triggered, failed };
}
