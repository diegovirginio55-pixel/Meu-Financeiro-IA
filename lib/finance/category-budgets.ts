import type { Transaction } from "./types";
import type { AlertCandidate } from "./alert-checks";
import { isGasto } from "./fluxo";
import { formatCurrency } from "./format";

/**
 * Orçamento por categoria (núcleo puro): limite mensal por categoria
 * ("Alimentação: R$ 800"), quanto já foi gasto no mês e os avisos de 80% e
 * de limite estourado (uma vez por mês cada).
 */
export type CategoryLimits = Record<string, number>;

export type CategoryUsage = { category: string; limit: number; spent: number; pct: number };

const MAX_LIMIT = 10_000_000;

export function sanitizeCategoryLimits(value: unknown): CategoryLimits {
  const limits: CategoryLimits = {};
  if (!value || typeof value !== "object") return limits;
  for (const [category, raw] of Object.entries(value as Record<string, unknown>)) {
    const name = category.trim().slice(0, 40);
    const limit = Number(raw);
    if (name && Number.isFinite(limit) && limit > 0 && limit < MAX_LIMIT) limits[name] = Math.round(limit * 100) / 100;
  }
  return limits;
}

export function categoryUsage(limits: CategoryLimits, monthTx: Transaction[]): CategoryUsage[] {
  const spentByCategory = new Map<string, number>();
  for (const transaction of monthTx) {
    if (!isGasto(transaction)) continue;
    spentByCategory.set(transaction.category, (spentByCategory.get(transaction.category) ?? 0) + Number(transaction.amount));
  }
  return Object.entries(limits)
    .map(([category, limit]) => {
      const spent = Math.round((spentByCategory.get(category) ?? 0) * 100) / 100;
      return { category, limit, spent, pct: limit > 0 ? spent / limit : 0 };
    })
    .sort((left, right) => right.pct - left.pct);
}

export function categoryBudgetAlerts(usage: CategoryUsage[], monthKey: string): AlertCandidate[] {
  const alerts: AlertCandidate[] = [];
  for (const item of usage) {
    if (item.pct >= 1) {
      alerts.push({
        kind: "category_budget",
        refKey: `${monthKey}:${item.category}:100`,
        title: `Limite estourado: ${item.category} 🚨`,
        body: `Você já gastou ${formatCurrency(item.spent)} de ${formatCurrency(item.limit)} em ${item.category} este mês.`,
        url: "/metas",
      });
    } else if (item.pct >= 0.8) {
      alerts.push({
        kind: "category_budget",
        refKey: `${monthKey}:${item.category}:80`,
        title: `${item.category}: ${Math.round(item.pct * 100)}% do limite ⚠️`,
        body: `${formatCurrency(item.spent)} de ${formatCurrency(item.limit)} — restam ${formatCurrency(item.limit - item.spent)} até o fim do mês.`,
        url: "/metas",
      });
    }
  }
  return alerts;
}
