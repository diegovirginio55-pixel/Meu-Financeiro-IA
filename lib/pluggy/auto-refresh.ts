import type { SupabaseClient } from "@supabase/supabase-js";
import { pluggyApi } from "./client";
import { syncBankConnection } from "./sync";

const PULL_STALE_MS = 10 * 60 * 1000;
const TRIGGER_STALE_MS = 60 * 60 * 1000;

type ConnectionRow = {
  id: string;
  user_id: string;
  pluggy_item_id: string;
  last_synced_at: string | null;
};

function connectionAge(connection: ConnectionRow): number {
  if (!connection.last_synced_at) return Number.POSITIVE_INFINITY;
  return Date.now() - new Date(connection.last_synced_at).getTime();
}

function ignorableTriggerError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /BEFORE_ALLOWED_FREQUENCY|ITEM_ALREADY_UPDATING|ITEM_IS_ALREADY_UPDATING|LOGIN_ERROR|WAITING_USER_INPUT/i.test(
    message,
  );
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
}): Promise<{ pulled: number; triggered: number }> {
  let pulled = 0;
  let triggered = 0;

  for (const connection of connections) {
    if (!connection.pluggy_item_id) continue;
    const age = connectionAge(connection);
    const shouldTrigger = !pullOnly && age >= TRIGGER_STALE_MS;
    const shouldPull = pullOnly || shouldTrigger || age >= PULL_STALE_MS;
    if (!shouldPull && !shouldTrigger) continue;

    if (shouldTrigger) {
      try {
        await pluggyApi.patchItem(
          connection.pluggy_item_id,
          webhookUrl ? { webhookUrl } : {},
        );
        triggered += 1;
      } catch (error) {
        if (!ignorableTriggerError(error)) {
          console.error("Erro ao pedir atualização na Pluggy:", error);
        }
      }
    }

    try {
      await syncBankConnection(supabase, connection.user_id, connection.id, connection.pluggy_item_id);
      pulled += 1;
    } catch (error) {
      console.error("Erro ao puxar saldo da Pluggy:", error);
    }
  }

  return { pulled, triggered };
}
