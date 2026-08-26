import type { Transaction } from "./types";
import { isGasto, isRenda, saoPauloMonthKey, shiftMonthKey } from "./fluxo";
import { inferCategoryFromDescription, isTransferDescription, resolvedCategory } from "./categories";
import { groupSubscriptions } from "./subscriptions";
import { formatCurrency, formatDate } from "./format";

export type InsightSeverity = "info" | "atencao" | "critico";

export interface Insight {
  id: string;
  kind: string;
  severity: InsightSeverity;
  icon: string;
  title: string;
  description: string;
  date: string;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Cobranças duplicadas: duas ou mais saídas com o mesmo valor no mesmo dia,
 * descrição parecida — provável cobrança em duplicidade.
 */
function detectDuplicateCharges(transactions: Transaction[], thisMonth: string): Insight[] {
  const insights: Insight[] = [];
  const byDateAmount = new Map<string, Transaction[]>();
  transactions
    .filter((t) => t.date.slice(0, 7) === thisMonth || t.date.slice(0, 7) === shiftMonthKey(thisMonth, -1))
    .filter(isGasto)
    .forEach((t) => {
      const key = `${t.date}:${Number(t.amount).toFixed(2)}`;
      const list = byDateAmount.get(key) ?? [];
      list.push(t);
      byDateAmount.set(key, list);
    });

  byDateAmount.forEach((list) => {
    if (list.length < 2) return;
    const [first] = list;
    insights.push({
      id: `duplicate:${first.date}:${first.amount}`,
      kind: "duplicate_charge",
      severity: "atencao",
      icon: "🔁",
      title: "Possível cobrança duplicada",
      description: `${list.length}x "${first.description.trim()}" de ${formatCurrency(Number(first.amount))} em ${formatDate(first.date)}.`,
      date: first.date,
    });
  });

  return insights;
}

/** Assinatura nova: cobrança recorrente-like que apareceu só este mês. */
function detectNewSubscriptions(transactions: Transaction[], thisMonth: string): Insight[] {
  const insights: Insight[] = [];
  const bySubKey = new Map<string, Transaction[]>();
  transactions.filter(isGasto).forEach((t) => {
    if (t.category !== "Assinaturas" && !inferCategoryFromDescriptionIsSubscription(t.description)) return;
    const key = t.description
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[0-9]/g, "")
      .trim();
    const list = bySubKey.get(key) ?? [];
    list.push(t);
    bySubKey.set(key, list);
  });

  bySubKey.forEach((list) => {
    const months = new Set(list.map((t) => t.date.slice(0, 7)));
    if (months.size !== 1 || !months.has(thisMonth)) return;
    const tx = list[list.length - 1];
    insights.push({
      id: `new_subscription:${tx.id}`,
      kind: "new_subscription",
      severity: "info",
      icon: "🆕",
      title: "Possível assinatura nova",
      description: `"${tx.description.trim()}" de ${formatCurrency(Number(tx.amount))} apareceu pela 1ª vez este mês.`,
      date: tx.date,
    });
  });

  return insights;
}

function inferCategoryFromDescriptionIsSubscription(description: string): boolean {
  return inferCategoryFromDescription(description) === "Assinaturas";
}

/** Assinatura que aumentou de preço — mesma lógica usada nos alertas. */
function detectSubscriptionIncrease(transactions: Transaction[], thisMonth: string): Insight[] {
  const insights: Insight[] = [];
  groupSubscriptions(transactions).forEach(({ byMonth, months, label }) => {
    const lastMonth = months[months.length - 1];
    if (lastMonth !== thisMonth && lastMonth !== shiftMonthKey(thisMonth, -1)) return;
    const latest = byMonth.get(lastMonth)!;
    const priorMonths = months.slice(0, -1).slice(-3);
    if (priorMonths.length < 2) return;
    const priorAmounts = priorMonths.map((m) => byMonth.get(m)!.amount);
    const priorAvg = average(priorAmounts);
    const stable = priorAmounts.every((a) => Math.abs(a - priorAvg) <= Math.max(1, priorAvg * 0.03));
    if (!stable) return;
    const increase = latest.amount - priorAvg;
    if (increase > Math.max(2, priorAvg * 0.05)) {
      insights.push({
        id: `subscription_increase:${label}:${lastMonth}`,
        kind: "subscription_increase",
        severity: "atencao",
        icon: "💸",
        title: "Assinatura ficou mais cara",
        description: `"${label}" custava ${formatCurrency(priorAvg)} e agora está ${formatCurrency(latest.amount)} (+${formatCurrency(increase)}).`,
        date: latest.date,
      });
    }
  });
  return insights;
}

/** Gasto recorrente que parou de aparecer depois de vários meses estável. */
function detectStoppedRecurring(transactions: Transaction[], thisMonth: string, dayOfMonth: number): Insight[] {
  if (dayOfMonth < 15) return [];
  const insights: Insight[] = [];
  groupSubscriptions(transactions, 3).forEach(({ months, label }) => {
    if (months.includes(thisMonth)) return;
    const lastMonth = months[months.length - 1];
    if (lastMonth !== shiftMonthKey(thisMonth, -1)) return;
    const recentMonths = months.filter((m) => m >= shiftMonthKey(thisMonth, -4));
    if (recentMonths.length < 3) return;
    insights.push({
      id: `stopped_recurring:${label}:${thisMonth}`,
      kind: "stopped_recurring",
      severity: "info",
      icon: "⏸️",
      title: "Gasto recorrente parou",
      description: `"${label}" cobrava todo mês e não apareceu em ${thisMonth.slice(5, 7)}/${thisMonth.slice(0, 4)}.`,
      date: `${thisMonth}-01`,
    });
  });
  return insights;
}

/** Transação de valor muito acima do padrão para aquela categoria. */
function detectUnusualTransactions(transactions: Transaction[], thisMonth: string): Insight[] {
  const insights: Insight[] = [];
  const byCategory = new Map<string, number[]>();
  transactions
    .filter((t) => t.date.slice(0, 7) !== thisMonth && isGasto(t))
    .forEach((t) => {
      const category = resolvedCategory(t);
      const list = byCategory.get(category) ?? [];
      list.push(Number(t.amount));
      byCategory.set(category, list);
    });

  transactions
    .filter((t) => t.date.slice(0, 7) === thisMonth && isGasto(t))
    .forEach((t) => {
      const category = resolvedCategory(t);
      const history = byCategory.get(category) ?? [];
      if (history.length < 5) return;
      const media = average(history);
      const amount = Number(t.amount);
      if (media >= 20 && amount > Math.max(150, media * 4)) {
        insights.push({
          id: `unusual_tx:${t.id}`,
          kind: "unusual_transaction",
          severity: "atencao",
          icon: "❗",
          title: "Gasto fora do padrão",
          description: `"${t.description.trim()}" de ${formatCurrency(amount)} em ${category} — bem acima da média de ${formatCurrency(media)}.`,
          date: t.date,
        });
      }
    });

  return insights.slice(0, 5);
}

/** Transação com categoria provavelmente diferente do que a descrição indica. */
function detectWrongCategory(transactions: Transaction[], thisMonth: string): Insight[] {
  const insights: Insight[] = [];
  transactions
    .filter((t) => t.date.slice(0, 7) === thisMonth && t.category !== "Outros" && t.category !== "Salário")
    .forEach((t) => {
      const inferred = inferCategoryFromDescription(t.description);
      if (!inferred || inferred === t.category) return;
      insights.push({
        id: `wrong_category:${t.id}`,
        kind: "wrong_category",
        severity: "info",
        icon: "🏷️",
        title: "Categoria pode estar errada",
        description: `"${t.description.trim()}" está em "${t.category}", mas parece mais um gasto de "${inferred}".`,
        date: t.date,
      });
    });
  return insights.slice(0, 5);
}

/** Salário do mês bem diferente da média dos últimos meses. */
function detectUnusualSalary(transactions: Transaction[], thisMonth: string): Insight[] {
  const salaryTx = transactions.filter((t) => isRenda(t) && t.category === "Salário");
  const byMonth = new Map<string, number>();
  salaryTx.forEach((t) => {
    const key = t.date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(t.amount));
  });
  const current = byMonth.get(thisMonth);
  if (!current) return [];
  const pastValues = Array.from(byMonth.entries())
    .filter(([key]) => key !== thisMonth)
    .map(([, v]) => v);
  if (pastValues.length < 2) return [];
  const media = average(pastValues);
  if (media <= 0) return [];
  const diffPct = ((current - media) / media) * 100;
  if (Math.abs(diffPct) < 15) return [];
  return [
    {
      id: `unusual_salary:${thisMonth}`,
      kind: "unusual_salary",
      severity: "info",
      icon: diffPct > 0 ? "📈" : "📉",
      title: diffPct > 0 ? "Salário acima do normal" : "Salário abaixo do normal",
      description: `Este mês entrou ${formatCurrency(current)} de salário, ${diffPct > 0 ? "acima" : "abaixo"} da média de ${formatCurrency(media)}.`,
      date: `${thisMonth}-01`,
    },
  ];
}

/** Transferência (Pix/TED) de valor muito acima do que costuma ser enviado. */
function detectUnusualTransfer(transactions: Transaction[], thisMonth: string): Insight[] {
  const transfers = transactions.filter((t) => t.type === "saida" && isTransferDescription(t.description));
  const history = transfers.filter((t) => t.date.slice(0, 7) !== thisMonth).map((t) => Number(t.amount));
  if (history.length < 3) return [];
  const media = average(history);
  const insights: Insight[] = [];
  transfers
    .filter((t) => t.date.slice(0, 7) === thisMonth)
    .forEach((t) => {
      const amount = Number(t.amount);
      if (amount > Math.max(300, media * 3)) {
        insights.push({
          id: `unusual_transfer:${t.id}`,
          kind: "unusual_transfer",
          severity: "atencao",
          icon: "🔀",
          title: "Transferência fora do padrão",
          description: `Você enviou ${formatCurrency(amount)} em ${formatDate(t.date)}, bem acima da sua média de ${formatCurrency(media)}.`,
          date: t.date,
        });
      }
    });
  return insights;
}

const SEVERITY_ORDER: Record<InsightSeverity, number> = { critico: 0, atencao: 1, info: 2 };

/**
 * Centro de Alertas/Insights: roda todos os detectores de anomalia sobre o
 * histórico de transações e devolve uma lista ordenada por gravidade e
 * data (mais recente primeiro).
 */
export function computeInsights({
  transactions,
  now = new Date(),
}: {
  transactions: Transaction[];
  now?: Date;
}): Insight[] {
  const thisMonth = saoPauloMonthKey(now);
  const dayOfMonth = Number(
    now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(8, 10),
  );

  const all = [
    ...detectDuplicateCharges(transactions, thisMonth),
    ...detectNewSubscriptions(transactions, thisMonth),
    ...detectSubscriptionIncrease(transactions, thisMonth),
    ...detectStoppedRecurring(transactions, thisMonth, dayOfMonth),
    ...detectUnusualTransactions(transactions, thisMonth),
    ...detectWrongCategory(transactions, thisMonth),
    ...detectUnusualSalary(transactions, thisMonth),
    ...detectUnusualTransfer(transactions, thisMonth),
  ];

  return all
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.date.localeCompare(a.date))
    .slice(0, 20);
}
