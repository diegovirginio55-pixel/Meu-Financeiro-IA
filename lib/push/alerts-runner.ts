import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSmartAlerts, computeWeeklySummary, type AlertCandidate } from "@/lib/finance/alert-checks";
import { sendPushToUser } from "./send";

/**
 * Registra que um alerta foi enviado (dedupe por user+kind+ref_key). Se
 * já existia, o upsert não insere nada e devolve lista vazia — sinal de
 * que esse alerta específico já foi avisado antes e não deve repetir.
 */
async function markAsSent(supabase: SupabaseClient, userId: string, candidate: AlertCandidate): Promise<boolean> {
  const { data, error } = await supabase
    .from("notification_log")
    .upsert(
      { user_id: userId, kind: candidate.kind, ref_key: candidate.refKey },
      { onConflict: "user_id,kind,ref_key", ignoreDuplicates: true },
    )
    .select();
  if (error) {
    console.error("Erro ao registrar notification_log:", error);
    return false;
  }
  return Boolean(data && data.length > 0);
}

async function dispatch(supabase: SupabaseClient, userId: string, candidate: AlertCandidate): Promise<boolean> {
  const isNew = await markAsSent(supabase, userId, candidate);
  if (!isNew) return false;
  await sendPushToUser(userId, { title: candidate.title, body: candidate.body, url: candidate.url });
  return true;
}

/**
 * Roda os alertas inteligentes e o resumo semanal para todos os usuários
 * com pelo menos uma conta cadastrada. Chamado pelo cron de sincronização
 * de bancos (GET /api/bank/cron), que já roda periodicamente.
 */
export async function runAlertsAndSummaries(supabase: SupabaseClient): Promise<{ users: number; sent: number }> {
  const { data: accountRows } = await supabase.from("accounts").select("user_id");
  const userIds = Array.from(new Set((accountRows ?? []).map((row) => row.user_id as string)));

  let sent = 0;
  for (const userId of userIds) {
    try {
      const alerts = await computeSmartAlerts(supabase, userId);
      const summary = await computeWeeklySummary(supabase, userId);
      const candidates = summary ? [...alerts, summary] : alerts;
      for (const candidate of candidates) {
        if (await dispatch(supabase, userId, candidate)) sent += 1;
      }
    } catch (error) {
      console.error("Erro ao calcular alertas para usuário:", userId, error);
    }
  }

  return { users: userIds.length, sent };
}
