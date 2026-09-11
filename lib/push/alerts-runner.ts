import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSmartAlerts, computeWeeklySummary, type AlertCandidate } from "@/lib/finance/alert-checks";
import { saoPauloHour } from "@/lib/finance/fluxo";
import { sendPushToUser } from "./send";

const DAILY_BUDGET_PUSH_START_HOUR = 7;
const DAILY_BUDGET_PUSH_END_HOUR = 10;

/**
 * O aviso "quanto você pode gastar hoje" só é enviado por push pela manhã
 * (o resto do dia ele já ficou obsoleto pra decisão do dia). Fora dessa
 * janela o candidato simplesmente não é despachado ainda — como ele não é
 * marcado como enviado, a próxima execução do cron (a cada 10 min) tenta
 * de novo até cair dentro do horário. Continua aparecendo normalmente no
 * Centro de Alertas do app, que não passa por aqui.
 */
function isDailyBudgetPushWindow(now: Date): boolean {
  const hour = saoPauloHour(now);
  return hour >= DAILY_BUDGET_PUSH_START_HOUR && hour < DAILY_BUDGET_PUSH_END_HOUR;
}

/**
 * Registra que um alerta foi enviado (dedupe por user+kind+ref_key). Se
 * já existia, o upsert não insere nada e devolve lista vazia — sinal de
 * que esse alerta específico já foi avisado antes e não deve repetir.
 */
async function markAsSent(supabase: SupabaseClient, userId: string, candidate: AlertCandidate): Promise<boolean> {
  const { data, error } = await supabase
    .from("notification_log")
    .upsert(
      {
        user_id: userId,
        kind: candidate.kind,
        ref_key: candidate.refKey,
        title: candidate.title,
        body: candidate.body,
        url: candidate.url,
      },
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

  const now = new Date();
  let sent = 0;
  for (const userId of userIds) {
    try {
      const alerts = await computeSmartAlerts(supabase, userId);
      const summary = await computeWeeklySummary(supabase, userId);
      const candidates = summary ? [...alerts, summary] : alerts;
      for (const candidate of candidates) {
        if (candidate.kind === "daily_budget" && !isDailyBudgetPushWindow(now)) continue;
        if (await dispatch(supabase, userId, candidate)) sent += 1;
      }
    } catch (error) {
      console.error("Erro ao calcular alertas para usuário:", userId, error);
    }
  }

  return { users: userIds.length, sent };
}
