import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/supabase/schema-compat";

type HeartbeatFields = {
  last_run_at?: string;
  last_ok_at?: string;
  last_error?: string | null;
};

/**
 * Registra o "sinal de vida" do cron. last_run_at = o cron rodou;
 * last_ok_at / last_error = resultado do sync (colunas da migration 0010 —
 * sem ela, grava só last_run_at como antes).
 */
export async function recordHeartbeat(supabase: SupabaseClient, key: string, fields: HeartbeatFields) {
  const { error } = await supabase.from("system_heartbeats").upsert({ key, ...fields }, { onConflict: "key" });
  if (!error) return;
  if (isMissingSchemaError(error) && fields.last_run_at) {
    await supabase.from("system_heartbeats").upsert({ key, last_run_at: fields.last_run_at }, { onConflict: "key" });
    return;
  }
  if (!isMissingSchemaError(error)) console.error("Erro ao registrar heartbeat:", error);
}
