import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { categoryBudgetAlerts, categoryUsage, sanitizeCategoryLimits, type CategoryLimits } from "./category-budgets";
import type { AlertCandidate } from "./alert-checks";
import type { Transaction } from "./types";
import { saoPauloMonthKey, shiftMonthKey } from "./fluxo";

/**
 * Limites por categoria ficam em internal_settings (só o servidor lê):
 * category_budgets:<userId>. Sem migration nova; quem chama passa o id do
 * usuário já autenticado.
 */
const keyFor = (userId: string) => `category_budgets:${userId}`;

export async function loadCategoryLimits(userId: string): Promise<CategoryLimits> {
  try {
    const { data, error } = await createAdminClient()
      .from("internal_settings")
      .select("value")
      .eq("key", keyFor(userId))
      .maybeSingle();
    if (error || !data) return {};
    return sanitizeCategoryLimits(JSON.parse(String(data.value)));
  } catch {
    return {};
  }
}

/** Avisos de 80% / limite estourado do mês atual (usado pelo cron de alertas, com o cliente admin). */
export async function computeCategoryBudgetAlertsForUser(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<AlertCandidate[]> {
  const limits = await loadCategoryLimits(userId);
  if (Object.keys(limits).length === 0) return [];
  const monthKey = saoPauloMonthKey(now);
  const { data } = await fetchAllRows<Transaction>((from, to) =>
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", `${monthKey}-01`)
      .lt("date", `${shiftMonthKey(monthKey, 1)}-01`)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return categoryBudgetAlerts(categoryUsage(limits, data), monthKey);
}

export async function saveCategoryLimits(userId: string, limits: CategoryLimits): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("internal_settings")
    .upsert({ key: keyFor(userId), value: JSON.stringify(sanitizeCategoryLimits(limits)), updated_at: now }, { onConflict: "key" });
  if (error) throw error;
}
