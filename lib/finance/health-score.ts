import type { Card, Debt, Goal, Transaction } from "./types";
import { isGasto, isRenda, lastNMonthKeys, saoPauloMonthKey } from "./fluxo";
import { formatCurrency } from "./format";

export type FactorStatus = "green" | "yellow" | "red";

export interface HealthFactor {
  key: string;
  label: string;
  score: number;
  weight: number;
  status: FactorStatus;
  detail: string;
}

export interface HealthScoreResult {
  score: number;
  factors: HealthFactor[];
  howToImprove: { factor: string; tip: string; potentialScore: number }[];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function healthScoreLabel(score: number): string {
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Boa";
  if (score >= 40) return "Regular";
  return "Precisa de atenção";
}

export function healthScoreTone(score: number): { stroke: string; glow: string; badge: string } {
  if (score >= 70) {
    return { stroke: "#34d399", glow: "rgba(52,211,153,0.35)", badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" };
  }
  if (score >= 40) {
    return { stroke: "#fbbf24", glow: "rgba(251,191,36,0.3)", badge: "bg-amber-500/15 text-amber-300 ring-amber-500/30" };
  }
  return { stroke: "#fb7185", glow: "rgba(251,113,133,0.3)", badge: "bg-rose-500/15 text-rose-300 ring-rose-500/30" };
}

function statusFor(score: number, greenAt = 66, yellowAt = 40): FactorStatus {
  if (score >= greenAt) return "green";
  if (score >= yellowAt) return "yellow";
  return "red";
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

const WEIGHTS = {
  reserva: 0.15,
  patrimonio: 0.15,
  comprometimento: 0.15,
  dividas: 0.1,
  cartao: 0.15,
  regularidade: 0.1,
  poupanca: 0.1,
  metas: 0.1,
};

/**
 * Calcula a nota de saúde financeira (0-100) a partir de 8 fatores: reserva
 * disponível, evolução do patrimônio, comprometimento da renda, dívidas,
 * utilização dos cartões, regularidade dos gastos, capacidade de poupança e
 * progresso das metas. Cada fator vira uma nota 0-100 própria e o total é a
 * média ponderada. Também sugere os 2 pontos que mais valeriam a pena
 * melhorar.
 */
export function computeHealthScore({
  transactions,
  cards,
  debts,
  goals,
  totalBalance,
  totalInvestments,
  now = new Date(),
}: {
  transactions: Transaction[];
  cards: Card[];
  debts: Debt[];
  goals: Goal[];
  totalBalance: number;
  totalInvestments: number;
  now?: Date;
}): HealthScoreResult {
  const thisMonth = saoPauloMonthKey(now);
  const monthKeys = lastNMonthKeys(6, thisMonth);
  const pastMonthKeys = monthKeys.slice(0, -1);

  const monthlyGastos = pastMonthKeys.map((key) =>
    transactions.filter((t) => t.date.startsWith(key) && isGasto(t)).reduce((s, t) => s + Number(t.amount), 0),
  );
  const monthlyEntradas = pastMonthKeys.map((key) =>
    transactions.filter((t) => t.date.startsWith(key) && isRenda(t)).reduce((s, t) => s + Number(t.amount), 0),
  );
  const mediaGastoMensal = average(monthlyGastos.filter((v) => v > 0));
  const mediaEntradaMensal = average(monthlyEntradas.filter((v) => v > 0));

  const monthTx = transactions.filter((t) => t.date.startsWith(thisMonth));
  const entradasMes = monthTx.filter(isRenda).reduce((s, t) => s + Number(t.amount), 0);
  const saidasMes = monthTx.filter(isGasto).reduce((s, t) => s + Number(t.amount), 0);
  const totalInvoices = cards.reduce((s, c) => s + Number(c.current_invoice), 0);
  const totalDebts = debts.filter((d) => !d.paid).reduce((s, d) => s + Number(d.amount), 0);

  const factors: HealthFactor[] = [];

  // 1) Reserva disponível — quantos meses de gasto o saldo em conta cobre.
  const mesesReserva = mediaGastoMensal > 0 ? totalBalance / mediaGastoMensal : totalBalance > 0 ? 6 : 0;
  const reservaScore = clamp((mesesReserva / 6) * 100);
  factors.push({
    key: "reserva",
    label: "Reserva disponível",
    score: reservaScore,
    weight: WEIGHTS.reserva,
    status: statusFor(reservaScore, 60, 25),
    detail:
      mediaGastoMensal > 0
        ? `Seu saldo em conta cobre ${mesesReserva.toFixed(1)} mês${mesesReserva >= 2 ? "es" : ""} de gastos.`
        : "Ainda sem histórico de gastos suficiente para calcular a reserva.",
  });

  // 2) Evolução do patrimônio — economia somada dos últimos meses.
  const somaEconomiaPassada = monthlyEntradas.reduce((s, v, i) => s + (v - monthlyGastos[i]), 0);
  const baseEntradas = Math.max(1, mediaEntradaMensal * pastMonthKeys.length);
  const trendRatio = somaEconomiaPassada / baseEntradas;
  const patrimonioScore = clamp(50 + trendRatio * 200);
  factors.push({
    key: "patrimonio",
    label: "Evolução do patrimônio",
    score: patrimonioScore,
    weight: WEIGHTS.patrimonio,
    status: statusFor(patrimonioScore),
    detail:
      somaEconomiaPassada >= 0
        ? `Você guardou ${formatCurrency(somaEconomiaPassada)} nos últimos meses.`
        : `Seus gastos superaram as entradas em ${formatCurrency(Math.abs(somaEconomiaPassada))} nos últimos meses.`,
  });

  // 3) Comprometimento da renda — quanto da entrada do mês já foi consumido.
  const rendaBase = Math.max(1, entradasMes || mediaEntradaMensal);
  const committedRatio = (saidasMes + totalInvoices) / rendaBase;
  const comprometimentoScore = clamp(100 - ((committedRatio - 0.5) / 0.7) * 100);
  factors.push({
    key: "comprometimento",
    label: "Comprometimento da renda",
    score: comprometimentoScore,
    weight: WEIGHTS.comprometimento,
    status: statusFor(comprometimentoScore, 55, 25),
    detail: `${Math.round(committedRatio * 100)}% da sua renda do mês já está comprometida com gastos e faturas.`,
  });

  // 4) Dívidas — peso das dívidas em aberto sobre o patrimônio bruto.
  const patrimonioBruto = Math.max(1, totalBalance + totalInvestments);
  const debtRatio = totalDebts / patrimonioBruto;
  const dividasScore = totalDebts === 0 ? 100 : clamp(100 - debtRatio * 200);
  factors.push({
    key: "dividas",
    label: "Dívidas",
    score: dividasScore,
    weight: WEIGHTS.dividas,
    status: statusFor(dividasScore, 70, 40),
    detail:
      totalDebts === 0
        ? "Você não tem dívidas em aberto."
        : `Suas dívidas em aberto somam ${formatCurrency(totalDebts)}.`,
  });

  // 5) Utilização dos cartões — fatura sobre limite disponível.
  const cardsWithLimit = cards.filter((c) => Number(c.credit_limit ?? 0) > 0);
  const totalLimits = cardsWithLimit.reduce((s, c) => s + Number(c.credit_limit ?? 0), 0);
  const cardUsage = totalLimits > 0 ? totalInvoices / totalLimits : null;
  const cartaoScore = cardUsage == null ? 75 : cardUsage <= 0.3 ? 100 : clamp(100 - ((cardUsage - 0.3) / 0.7) * 100);
  factors.push({
    key: "cartao",
    label: "Utilização dos cartões",
    score: cartaoScore,
    weight: WEIGHTS.cartao,
    status: statusFor(cartaoScore, 70, 40),
    detail:
      cardUsage == null
        ? "Sem limite de cartão cadastrado para calcular a utilização."
        : `Sua fatura usa ${Math.round(cardUsage * 100)}% do limite dos cartões (ideal é até 30%).`,
  });

  // 6) Regularidade dos gastos — quão estáveis são os gastos mês a mês.
  const gastosValidos = monthlyGastos.filter((v) => v > 0);
  const mediaGastos = average(gastosValidos);
  const cv = mediaGastos > 0 ? stdDev(gastosValidos, mediaGastos) / mediaGastos : 0;
  const regularidadeScore = gastosValidos.length >= 2 ? clamp(100 - cv * 150) : 70;
  factors.push({
    key: "regularidade",
    label: "Regularidade dos gastos",
    score: regularidadeScore,
    weight: WEIGHTS.regularidade,
    status: statusFor(regularidadeScore),
    detail:
      gastosValidos.length >= 2
        ? cv <= 0.2
          ? "Seus gastos mensais estão bem estáveis."
          : "Seus gastos variam bastante de um mês para o outro."
        : "Ainda sem meses suficientes para medir a regularidade.",
  });

  // 7) Capacidade de poupança — % da renda do mês que sobrou.
  const savingsRate = entradasMes > 0 ? (entradasMes - saidasMes) / entradasMes : 0;
  const poupancaScore = clamp(savingsRate * 400);
  factors.push({
    key: "poupanca",
    label: "Capacidade de poupança",
    score: poupancaScore,
    weight: WEIGHTS.poupanca,
    status: statusFor(poupancaScore, 50, 20),
    detail:
      entradasMes > 0
        ? `Você guardou ${Math.round(savingsRate * 100)}% do que entrou este mês.`
        : "Ainda sem entradas registradas este mês.",
  });

  // 8) Metas — progresso das metas ativas.
  const activeGoals = goals.filter((g) => Number(g.current_amount) < Number(g.target_amount));
  let metasScore = 60;
  let metasDetail = "Você ainda não tem metas de economia cadastradas.";
  if (activeGoals.length > 0) {
    const progresses = activeGoals.map((g) => clamp((Number(g.current_amount) / Math.max(1, Number(g.target_amount))) * 100));
    metasScore = average(progresses);
    metasDetail = `Suas metas estão em média ${Math.round(metasScore)}% concluídas.`;
  } else if (goals.length > 0) {
    metasScore = 100;
    metasDetail = "Todas as suas metas já foram concluídas!";
  }
  factors.push({
    key: "metas",
    label: "Metas",
    score: metasScore,
    weight: WEIGHTS.metas,
    status: statusFor(metasScore, 60, 30),
    detail: metasDetail,
  });

  const score = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0));

  const howToImprove = [...factors]
    .filter((f) => f.status !== "green")
    .sort((a, b) => b.weight * (100 - b.score) - a.weight * (100 - a.score))
    .slice(0, 2)
    .map((factor) => {
      const gain = Math.round(factor.weight * (100 - factor.score));
      return {
        factor: factor.label,
        tip: tipFor(factor.key),
        potentialScore: Math.min(100, score + gain),
      };
    });

  return { score, factors, howToImprove };
}

function tipFor(key: string): string {
  switch (key) {
    case "reserva":
      return "Guardar um pouco mais em conta até ter de 3 a 6 meses de gastos como reserva.";
    case "patrimonio":
      return "Manter as entradas maiores que as saídas por mais alguns meses seguidos.";
    case "comprometimento":
      return "Reduzir gastos variáveis para sobrar mais renda livre no fim do mês.";
    case "dividas":
      return "Priorizar o pagamento das dívidas em aberto.";
    case "cartao":
      return "Deixar a fatura do cartão abaixo de 30% do limite disponível.";
    case "regularidade":
      return "Tentar manter os gastos mais parecidos de um mês para o outro.";
    case "poupanca":
      return "Separar uma % fixa da renda antes de gastar o resto.";
    case "metas":
      return "Fazer um aporte nas metas de economia este mês.";
    default:
      return "Continuar acompanhando esse indicador.";
  }
}
