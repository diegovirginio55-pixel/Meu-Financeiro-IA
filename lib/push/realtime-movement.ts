import type { SupabaseClient } from "@supabase/supabase-js";
import { dailyLimitStatus, type DailyLimitStatus } from "@/lib/finance/daily-limit";
import { realtimeMovementMessage, type RealtimeMovement, type RealtimeMovementContext } from "./realtime-message";
import { saoPauloTodayKey, shiftMonthKey } from "@/lib/finance/fluxo";
import { categoryUsage } from "@/lib/finance/category-budgets";
import { loadCategoryLimits } from "@/lib/finance/category-budgets-store";
import { loadEstimatedBalance } from "@/lib/ingest/estimated-balance";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { Transaction } from "@/lib/finance/types";
import { categoryActionExtras, categorySuggestions, logMovementNotice, sendPushToUser } from "./send";
import { runAlertsForUser } from "./alerts-runner";
import type { PushPayload } from "./payload";

export type { RealtimeMovement } from "./realtime-message";

async function loadContext(
  supabase: SupabaseClient,
  userId: string,
  movement: RealtimeMovement,
  now: Date,
): Promise<RealtimeMovementContext> {
  const todayKey = saoPauloTodayKey(now);
  const monthKey = todayKey.slice(0, 7);
  const [estimate, monthTxRes, budgetRes, limits] = await Promise.all([
    loadEstimatedBalance(supabase, userId),
    fetchAllRows<Transaction>((from, to) =>
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .gte("date", `${monthKey}-01`)
        .lt("date", `${shiftMonthKey(monthKey, 1)}-01`)
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    supabase.from("monthly_budgets").select("spending_limit").eq("user_id", userId).eq("month_key", monthKey).maybeSingle(),
    movement.type === "saida" ? loadCategoryLimits(userId) : Promise.resolve({}),
  ]);
  const monthTx = monthTxRes.data ?? [];

  let daily: DailyLimitStatus | null = null;
  if (movement.type === "saida") {
    // Mesma base do aviso "Seu limite de hoje" (saldo que o banco informou).
    const rawBalance = (estimate?.rawAccounts ?? []).reduce((sum, account) => sum + Number(account.balance), 0);
    const spendingLimit = Number((budgetRes.data as { spending_limit: number | null } | null)?.spending_limit) || null;
    daily = dailyLimitStatus({ tx: monthTx, totalBalance: rawBalance, spendingLimit, todayKey });
  }

  const usage = categoryUsage(limits, monthTx).find((item) => item.category === movement.category);
  return {
    balance: estimate?.balance ?? null,
    daily,
    categoryLimit: usage ? { spent: usage.spent, limit: usage.limit } : null,
  };
}

/**
 * Movimentação que acabou de chegar pelo celular: avisa na hora (com saldo
 * e controle do dia) e já roda os alertas de controle do usuário — "passou
 * do limite de hoje", "80% da categoria" etc. saem junto, sem esperar o
 * próximo ciclo do cron. Erros só vão para o log: o lançamento já foi
 * registrado.
 */
export async function notifyRealtimeMovement(
  supabase: SupabaseClient,
  userId: string,
  movement: RealtimeMovement,
  now = new Date(),
): Promise<void> {
  try {
    const context = await loadContext(supabase, userId, movement, now);
    const { title, body } = realtimeMovementMessage(movement, context);
    let payload: PushPayload = {
      title,
      body,
      url: movement.type === "saida" ? `/categorizar/${movement.id}` : "/dashboard",
    };
    if (movement.type === "saida") {
      payload = { ...payload, ...categoryActionExtras(userId, movement, await categorySuggestions(userId)) };
    }
    if (await logMovementNotice(userId, `tx:${movement.id}`, payload)) {
      await sendPushToUser(userId, payload, "high");
    }
  } catch (error) {
    console.error("Erro ao avisar movimentação em tempo real:", error);
  }

  try {
    await runAlertsForUser(supabase, userId, now);
  } catch (error) {
    console.error("Erro ao rodar alertas depois da movimentação:", error);
  }
}
