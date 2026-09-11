import { describe, expect, it } from "vitest";
import { computeBudgetProgress } from "../budget";
import { saoPauloMonthKey } from "../fluxo";
import { makeTx } from "./fixtures";

const NOW = new Date("2026-01-20T12:00:00-03:00");
const MONTH = saoPauloMonthKey(NOW);

describe("computeBudgetProgress", () => {
  it("mostra status 'sem_meta' quando o usuário não definiu orçamento", () => {
    const progress = computeBudgetProgress({ transactions: [], budget: null, now: NOW });
    expect(progress.spendStatus).toBe("sem_meta");
    expect(progress.savingsStatus).toBe("sem_meta");
    expect(progress.spendingLimit).toBeNull();
    expect(progress.savingsTarget).toBeNull();
  });

  it("marca como 'excedido' quando já gastou mais que o limite definido", () => {
    const tx = [makeTx({ date: `${MONTH}-10`, amount: 1200, type: "saida", category: "Compras" })];
    const progress = computeBudgetProgress({
      transactions: tx,
      budget: { monthKey: MONTH, spendingLimit: 1000, savingsTarget: null },
      now: NOW,
    });
    expect(progress.spendStatus).toBe("excedido");
    expect(progress.spentThisMonth).toBe(1200);
  });

  it("marca como 'atencao' quando a projeção do mês passa bem do limite", () => {
    // Em 20 dias já gastou 800; projeção pro mês inteiro (31 dias) fica bem
    // acima do limite de 1000, mesmo sem ainda ter excedido o valor gasto.
    const tx = [makeTx({ date: `${MONTH}-10`, amount: 800, type: "saida", category: "Compras" })];
    const progress = computeBudgetProgress({
      transactions: tx,
      budget: { monthKey: MONTH, spendingLimit: 1000, savingsTarget: null },
      now: NOW,
    });
    expect(progress.spendStatus).toBe("atencao");
  });

  it("marca como 'dentro' quando o gasto está de acordo com o orçamento", () => {
    const tx = [makeTx({ date: `${MONTH}-10`, amount: 100, type: "saida", category: "Compras" })];
    const progress = computeBudgetProgress({
      transactions: tx,
      budget: { monthKey: MONTH, spendingLimit: 1000, savingsTarget: null },
      now: NOW,
    });
    expect(progress.spendStatus).toBe("dentro");
    expect(progress.dailyAllowance).toBeGreaterThan(0);
  });

  it("reconhece meta de economia batida", () => {
    const tx = [
      makeTx({ date: `${MONTH}-05`, amount: 3000, type: "entrada", category: "Salário" }),
      makeTx({ date: `${MONTH}-10`, amount: 500, type: "saida", category: "Compras" }),
    ];
    const progress = computeBudgetProgress({
      transactions: tx,
      budget: { monthKey: MONTH, spendingLimit: null, savingsTarget: 1000 },
      now: NOW,
    });
    expect(progress.savingsThisMonth).toBe(2500);
    expect(progress.savingsStatus).toBe("dentro");
  });

  it("marca meta de economia em risco quando o ritmo está bem abaixo do necessário", () => {
    const tx = [
      makeTx({ date: `${MONTH}-05`, amount: 1000, type: "entrada", category: "Salário" }),
      makeTx({ date: `${MONTH}-06`, amount: 950, type: "saida", category: "Compras" }),
    ];
    const progress = computeBudgetProgress({
      transactions: tx,
      budget: { monthKey: MONTH, spendingLimit: null, savingsTarget: 2000 },
      now: NOW,
    });
    expect(progress.savingsStatus).toBe("atencao");
  });
});
