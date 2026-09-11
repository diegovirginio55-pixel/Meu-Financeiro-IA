import type { Transaction } from "./types";
import { isGasto, isRenda, saoPauloMonthKey, saoPauloTodayKey } from "./fluxo";
import { formatCurrency } from "./format";

export interface MonthlyBudget {
  monthKey: string;
  spendingLimit: number | null;
  savingsTarget: number | null;
}

export type BudgetStatus = "sem_meta" | "dentro" | "atencao" | "excedido";

export interface BudgetProgress {
  monthKey: string;
  daysElapsed: number;
  daysInMonth: number;
  spentThisMonth: number;
  entradasThisMonth: number;
  savingsThisMonth: number;
  spendingLimit: number | null;
  savingsTarget: number | null;
  projectedSpend: number;
  spendStatus: BudgetStatus;
  spendRemaining: number | null;
  dailyAllowance: number | null;
  savingsStatus: BudgetStatus;
  savingsProgressPct: number | null;
  tips: string[];
}

function daysInMonthOf(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

/**
 * Cruza o orçamento que o usuário definiu para o mês (quanto está disposto
 * a gastar e a economizar) com o que já aconteceu de fato, pra dar um
 * retrato claro de "como estou indo" e dicas práticas do que fazer a
 * partir de agora — o mesmo cálculo alimenta o card "Orçamento do mês" em
 * Metas e os alertas inteligentes (push + Central de Alertas).
 */
export function computeBudgetProgress({
  transactions,
  budget,
  now = new Date(),
}: {
  transactions: Transaction[];
  budget: MonthlyBudget | null;
  now?: Date;
}): BudgetProgress {
  const monthKey = saoPauloMonthKey(now);
  const todayKey = saoPauloTodayKey(now);
  const daysInMonth = daysInMonthOf(monthKey);
  const daysElapsed = Math.min(daysInMonth, Number(todayKey.slice(8, 10)));

  const monthTx = transactions.filter((t) => t.date.startsWith(monthKey));
  const spentThisMonth = monthTx.filter(isGasto).reduce((s, t) => s + Number(t.amount), 0);
  const entradasThisMonth = monthTx.filter(isRenda).reduce((s, t) => s + Number(t.amount), 0);
  const savingsThisMonth = entradasThisMonth - spentThisMonth;

  const spendingLimit = budget?.spendingLimit && budget.spendingLimit > 0 ? budget.spendingLimit : null;
  const savingsTarget = budget?.savingsTarget && budget.savingsTarget > 0 ? budget.savingsTarget : null;

  const projectedSpend = daysElapsed > 0 ? (spentThisMonth / daysElapsed) * daysInMonth : spentThisMonth;

  let spendStatus: BudgetStatus = "sem_meta";
  let spendRemaining: number | null = null;
  let dailyAllowance: number | null = null;
  const tips: string[] = [];

  if (spendingLimit != null) {
    spendRemaining = spendingLimit - spentThisMonth;
    const daysLeft = Math.max(1, daysInMonth - daysElapsed + 1);
    dailyAllowance = Math.max(0, spendRemaining) / daysLeft;

    if (spentThisMonth > spendingLimit) {
      spendStatus = "excedido";
      tips.push(
        `Você já gastou ${formatCurrency(spentThisMonth)}, passando o orçamento de ${formatCurrency(spendingLimit)} em ${formatCurrency(spentThisMonth - spendingLimit)}.`,
      );
    } else if (projectedSpend > spendingLimit * 1.05) {
      spendStatus = "atencao";
      tips.push(
        `No ritmo atual, você deve fechar o mês em ${formatCurrency(projectedSpend)} — acima do orçamento. Para não passar, gaste no máximo ${formatCurrency(dailyAllowance)}/dia nos próximos ${daysLeft} dia(s).`,
      );
    } else {
      spendStatus = "dentro";
      tips.push(
        `Você está dentro do orçamento. Ainda pode gastar até ${formatCurrency(dailyAllowance)}/dia nos próximos ${daysLeft} dia(s).`,
      );
    }
  }

  let savingsStatus: BudgetStatus = "sem_meta";
  let savingsProgressPct: number | null = null;

  if (savingsTarget != null) {
    savingsProgressPct = Math.max(0, Math.min(100, Math.round((savingsThisMonth / savingsTarget) * 100)));
    if (savingsThisMonth >= savingsTarget) {
      savingsStatus = "dentro";
      tips.push(`Meta de economia batida! Você já guardou ${formatCurrency(savingsThisMonth)} este mês. 🎉`);
    } else {
      const faltam = savingsTarget - savingsThisMonth;
      const daysLeft = Math.max(1, daysInMonth - daysElapsed);
      const requiredPerDay = savingsTarget / daysInMonth;
      const currentPerDay = daysElapsed > 0 ? savingsThisMonth / daysElapsed : 0;
      if (daysElapsed >= 10 && currentPerDay < requiredPerDay * 0.7) {
        savingsStatus = "atencao";
        tips.push(
          `Faltam ${formatCurrency(faltam)} pra bater a meta de economizar ${formatCurrency(savingsTarget)} este mês, e restam ${daysLeft} dia(s). Vale reduzir gastos variáveis pra recuperar o ritmo.`,
        );
      } else {
        savingsStatus = "dentro";
        tips.push(`Faltam ${formatCurrency(faltam)} pra bater a meta de economizar ${formatCurrency(savingsTarget)} este mês — no ritmo certo.`);
      }
    }
  }

  if (tips.length === 0) {
    tips.push("Defina quanto pretende gastar e economizar este mês para o sistema te ajudar a acompanhar.");
  }

  return {
    monthKey,
    daysElapsed,
    daysInMonth,
    spentThisMonth,
    entradasThisMonth,
    savingsThisMonth,
    spendingLimit,
    savingsTarget,
    projectedSpend,
    spendStatus,
    spendRemaining,
    dailyAllowance,
    savingsStatus,
    savingsProgressPct,
    tips,
  };
}
