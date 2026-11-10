import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSmartAlerts, computeWeeklySummary, type AlertCandidate } from "@/lib/finance/alert-checks";
import { saoPauloHour } from "@/lib/finance/fluxo";
import { sendPushToUser } from "./send";
import { signPushAction } from "./actions";
import type { PushPayload } from "./payload";
import { billKey, computeBillRemindersForUser, type BillRef } from "@/lib/finance/bill-reminders";
import { computeCategoryBudgetAlertsForUser } from "@/lib/finance/category-budgets-store";

const DAILY_BUDGET_PUSH_START_HOUR = 7;
const DAILY_BUDGET_PUSH_END_HOUR = 10;
/** Fora deste horário os alertas não urgentes esperam (nada de push à meia-noite). */
const QUIET_END_HOUR = 8;
const QUIET_START_HOUR = 22;

/**
 * O aviso "quanto você pode gastar hoje" só é enviado por push pela manhã
 * (o resto do dia ele já ficou obsoleto pra decisão do dia). Fora dessa
 * janela o candidato simplesmente não é despachado ainda — como ele não é
 * marcado como enviado, a próxima execução do cron tenta de novo até cair
 * dentro do horário. Continua aparecendo normalmente no Centro de Alertas
 * do app, que não passa por aqui.
 */
function isDailyBudgetPushWindow(now: Date): boolean {
  const hour = saoPauloHour(now);
  return hour >= DAILY_BUDGET_PUSH_START_HOUR && hour < DAILY_BUDGET_PUSH_END_HOUR;
}

/**
 * Resumo semanal, saldo baixo e avisos do mês viravam push logo depois da
 * meia-noite (primeiro cron do dia novo). Agora esperam até as 8h.
 */
function isAwakeHours(now: Date): boolean {
  const hour = saoPauloHour(now);
  return hour >= QUIET_END_HOUR && hour < QUIET_START_HOUR;
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

async function dispatch(
  supabase: SupabaseClient,
  userId: string,
  candidate: AlertCandidate,
  extras: Partial<PushPayload> = {},
): Promise<boolean> {
  const isNew = await markAsSent(supabase, userId, candidate);
  if (!isNew) return false;
  const result = await sendPushToUser(userId, {
    title: candidate.title,
    body: candidate.body,
    url: candidate.url,
    ...extras,
  });
  // Nenhuma entrega e alguma falha foi temporária (sem resposta, 429, 5xx):
  // desfaz o registro para a próxima execução tentar de novo (antes o
  // alerta se perdia). Falha permanente (ex.: 403 de inscrição antiga) não
  // repete — senão o alerta sumia e voltava a cada execução.
  if (result.subscriptions > 0 && result.delivered === 0 && result.transient > 0) {
    await supabase
      .from("notification_log")
      .delete()
      .eq("user_id", userId)
      .eq("kind", candidate.kind)
      .eq("ref_key", candidate.refKey);
    return false;
  }
  return result.delivered > 0;
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
  if (!isAwakeHours(now) && !isDailyBudgetPushWindow(now)) {
    return { users: userIds.length, sent: 0 };
  }

  let sent = 0;
  for (const userId of userIds) {
    try {
      const alerts = await computeSmartAlerts(supabase, userId);
      const summary = await computeWeeklySummary(supabase, userId);
      const { reminders, paidKeys } = await computeBillRemindersForUser(supabase, userId, now);
      const categoryAlerts = await computeCategoryBudgetAlertsForUser(supabase, userId, now).catch((error) => {
        console.error("Erro ao calcular limites por categoria:", error);
        return [];
      });
      const candidates: (AlertCandidate & { bill?: BillRef; income?: boolean })[] = [
        ...alerts.map((alert) => withCardBill(alert)),
        ...(summary ? [summary] : []),
        ...reminders,
        ...categoryAlerts,
      ];
      for (const candidate of candidates) {
        if (candidate.kind === "daily_budget") {
          if (!isDailyBudgetPushWindow(now)) continue;
        } else if (!isAwakeHours(now)) {
          continue;
        }
        // Fatura já marcada como paga: não avisa mais.
        if (candidate.bill && paidKeys.has(billKey(candidate.bill))) continue;
        const extras = candidate.bill ? billActionExtras(userId, candidate.bill, candidate.income) : {};
        // A central de notificações guarda o mesmo link (tela com o botão "Já paguei").
        const stored = extras.url ? { ...candidate, url: extras.url } : candidate;
        if (await dispatch(supabase, userId, stored, extras)) sent += 1;
      }
    } catch (error) {
      console.error("Erro ao calcular alertas para usuário:", userId, error);
    }
  }

  return { users: userIds.length, sent };
}

/** "Fatura chegando" (refKey = cartão:vencimento) também ganha o botão "Já paguei". */
function withCardBill(alert: AlertCandidate): AlertCandidate & { bill?: BillRef } {
  if (alert.kind !== "card_due") return alert;
  const [id, dueDate] = alert.refKey.split(":");
  return id && dueDate ? { ...alert, bill: { kind: "card", id, dueDate } } : alert;
}

/**
 * Botão "Já paguei" (Android) e, ao tocar na notificação, a tela /lembrete
 * com o mesmo botão (iPhone não mostra botões em notificações de PWA).
 */
function billActionExtras(userId: string, bill: BillRef, income = false): Partial<PushPayload> {
  const token = signPushAction({ k: "bill", u: userId, b: bill.kind, r: bill.id, d: bill.dueDate });
  if (!token) return {};
  return {
    actions: [{ action: "paid", title: income ? "✅ Já recebi" : "✅ Já paguei" }],
    actionToken: token,
    url: `/lembrete?t=${encodeURIComponent(token)}`,
  };
}
