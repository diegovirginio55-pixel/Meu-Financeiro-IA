import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Card, Goal, Transaction } from "./types";
import { isGasto, isRenda, saoPauloMonthKey, saoPauloTodayKey } from "./fluxo";
import { isInvestmentMovement } from "./investment-movements";
import { resolvedCategory } from "./categories";
import { formatCurrency } from "./format";

export interface CategoryDiff {
  category: string;
  atual: number;
  projetado: number;
  media: number;
  diferenca: number;
}

export interface MonthReport {
  monthKey: string;
  monthLabel: string;
  progressPct: number;
  daysElapsed: number;
  daysInMonth: number;
  entradas: number;
  saidas: number;
  aportes: number;
  faturas: number;
  economiaAtual: number;
  ritmoPct: number;
  ritmoStatus: "acima" | "normal" | "abaixo";
  previsaoFimMes: number;
  mediaHistorica: number;
  motivoPrincipal: CategoryDiff | null;
  recomendacoes: string[];
}

function daysInMonthOf(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

/**
 * Monta o relatório automático de "Meu Mês": quanto entrou, saiu, foi
 * investido e está em fatura; se o ritmo de gastos está acima do normal
 * (comparado à média dos meses anteriores); qual categoria mais pesou nessa
 * diferença; a projeção de gasto para o fechamento do mês; e sugestões
 * práticas do que fazer agora.
 */
export function computeMonthReport({
  transactions,
  cards,
  goals,
  now = new Date(),
}: {
  transactions: Transaction[];
  cards: Card[];
  goals: Goal[];
  now?: Date;
}): MonthReport {
  const monthKey = saoPauloMonthKey(now);
  const todayKey = saoPauloTodayKey(now);
  const daysInMonth = daysInMonthOf(monthKey);
  const daysElapsed = Math.min(daysInMonth, Number(todayKey.slice(8, 10)));
  const progressPct = Math.round((daysElapsed / daysInMonth) * 100);

  const monthTx = transactions.filter((t) => t.date.startsWith(monthKey));
  const entradas = monthTx.filter(isRenda).reduce((s, t) => s + Number(t.amount), 0);
  const saidas = monthTx.filter(isGasto).reduce((s, t) => s + Number(t.amount), 0);
  const aportes = monthTx
    .filter((t) => t.type === "saida" && isInvestmentMovement(t))
    .reduce((s, t) => s + Number(t.amount), 0);
  const faturas = cards.reduce((s, c) => s + Number(c.current_invoice), 0);
  const economiaAtual = entradas - saidas;

  // Média histórica: total de saídas nos meses anteriores completos com dado.
  const pastMonthsTotals = new Map<string, number>();
  transactions
    .filter((t) => t.date.slice(0, 7) !== monthKey && isGasto(t))
    .forEach((t) => {
      const key = t.date.slice(0, 7);
      pastMonthsTotals.set(key, (pastMonthsTotals.get(key) ?? 0) + Number(t.amount));
    });
  const pastTotals = Array.from(pastMonthsTotals.values());
  const mediaHistorica = pastTotals.length > 0 ? pastTotals.reduce((s, v) => s + v, 0) / pastTotals.length : 0;

  const previsaoFimMes = daysElapsed > 0 ? (saidas / daysElapsed) * daysInMonth : saidas;
  const ritmoPct = mediaHistorica > 0 ? ((previsaoFimMes - mediaHistorica) / mediaHistorica) * 100 : 0;
  const ritmoStatus: MonthReport["ritmoStatus"] =
    ritmoPct > 8 ? "acima" : ritmoPct < -8 ? "abaixo" : "normal";

  // Motivo principal: categoria com a maior diferença (em R$) entre a projeção
  // deste mês e a média histórica da mesma categoria.
  const currentByCategory = new Map<string, number>();
  monthTx.filter(isGasto).forEach((t) => {
    const category = resolvedCategory(t);
    currentByCategory.set(category, (currentByCategory.get(category) ?? 0) + Number(t.amount));
  });

  const pastByCategory = new Map<string, number[]>();
  const pastMonthKeys = Array.from(pastMonthsTotals.keys());
  pastMonthKeys.forEach((key) => {
    const totals = new Map<string, number>();
    transactions
      .filter((t) => t.date.startsWith(key) && isGasto(t))
      .forEach((t) => {
        const category = resolvedCategory(t);
        totals.set(category, (totals.get(category) ?? 0) + Number(t.amount));
      });
    totals.forEach((value, category) => {
      const list = pastByCategory.get(category) ?? [];
      list.push(value);
      pastByCategory.set(category, list);
    });
  });

  let motivoPrincipal: CategoryDiff | null = null;
  currentByCategory.forEach((atual, category) => {
    const history = pastByCategory.get(category) ?? [];
    const media = history.length > 0 ? history.reduce((s, v) => s + v, 0) / pastMonthKeys.length : 0;
    const projetado = daysElapsed > 0 ? (atual / daysElapsed) * daysInMonth : atual;
    const diferenca = projetado - media;
    if (diferenca > 0 && (!motivoPrincipal || diferenca > motivoPrincipal.diferenca)) {
      motivoPrincipal = { category, atual, projetado, media, diferenca };
    }
  });

  const recomendacoes: string[] = [];
  if (ritmoStatus === "acima" && previsaoFimMes > mediaHistorica) {
    const excesso = previsaoFimMes - mediaHistorica;
    recomendacoes.push(`Reduzir gastos variáveis em ${formatCurrency(excesso)} para fechar o mês no ritmo normal.`);
  }
  if (faturas > 0) {
    recomendacoes.push(`Reservar ${formatCurrency(faturas)} para a fatura do cartão.`);
  }
  const activeGoal = goals.find((g) => Number(g.current_amount) < Number(g.target_amount));
  if (activeGoal) {
    const restante = Number(activeGoal.target_amount) - Number(activeGoal.current_amount);
    if (activeGoal.deadline) {
      const monthsLeft = Math.max(
        1,
        Math.round(
          (new Date(`${activeGoal.deadline}T12:00:00`).getTime() - new Date(`${todayKey}T12:00:00`).getTime()) /
            (30 * 86_400_000),
        ),
      );
      const aporteNecessario = restante / monthsLeft;
      recomendacoes.push(
        `Manter aporte de ${formatCurrency(aporteNecessario)}/mês para atingir a meta "${activeGoal.name}".`,
      );
    } else if (aportes > 0) {
      recomendacoes.push(`Manter aporte de ${formatCurrency(aportes)} para seguir avançando na meta "${activeGoal.name}".`);
    } else {
      recomendacoes.push(`Fazer um aporte este mês para avançar na meta "${activeGoal.name}" (faltam ${formatCurrency(restante)}).`);
    }
  }
  if (recomendacoes.length === 0) {
    recomendacoes.push("Seu ritmo está normal este mês — continue assim.");
  }

  return {
    monthKey,
    monthLabel: fullMonthLabel(monthKey),
    progressPct,
    daysElapsed,
    daysInMonth,
    entradas,
    saidas,
    aportes,
    faturas,
    economiaAtual,
    ritmoPct: Number(ritmoPct.toFixed(1)),
    ritmoStatus,
    previsaoFimMes,
    mediaHistorica,
    motivoPrincipal,
    recomendacoes: recomendacoes.slice(0, 3),
  };
}

function fullMonthLabel(monthKey: string): string {
  const raw = format(parseISO(`${monthKey}-01`), "MMMM", { locale: ptBR });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
