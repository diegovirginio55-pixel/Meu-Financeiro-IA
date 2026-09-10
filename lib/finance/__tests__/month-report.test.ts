import { describe, expect, it } from "vitest";
import { computeMonthReport } from "../month-report";
import { makeCard, makeGoal, makeTx } from "./fixtures";

const NOW = new Date("2026-06-15T12:00:00Z"); // dia 15 de um mês com 30 dias

describe("computeMonthReport", () => {
  it("calcula entradas, saídas, faturas e economia do mês corretamente", () => {
    const transactions = [
      makeTx({ date: "2026-06-05", type: "entrada", category: "Salário", amount: 5000 }),
      makeTx({ date: "2026-06-10", type: "saida", amount: 1200, description: "Mercado" }),
      makeTx({ date: "2026-06-12", type: "saida", amount: 300, description: "Lazer" }),
    ];
    const card = makeCard({ current_invoice: 400 });

    const report = computeMonthReport({ transactions, cards: [card], goals: [], now: NOW });

    expect(report.entradas).toBe(5000);
    expect(report.saidas).toBe(1500);
    expect(report.faturas).toBe(400);
    expect(report.economiaAtual).toBe(3500);
    expect(report.daysElapsed).toBe(15);
    expect(report.progressPct).toBe(50);
  });

  it("marca ritmo 'acima' quando a projeção de gastos supera bastante a média histórica", () => {
    const transactions = [
      // 3 meses anteriores gastando 1000/mês.
      ...["2026-03", "2026-04", "2026-05"].map((month) => makeTx({ date: `${month}-10`, type: "saida", amount: 1000 })),
      // Neste mês, já gastou 1000 em 15 dias -> projeção de 2000 (dobro da média).
      makeTx({ date: "2026-06-10", type: "saida", amount: 1000, description: "Compras" }),
    ];

    const report = computeMonthReport({ transactions, cards: [], goals: [], now: NOW });

    expect(report.ritmoStatus).toBe("acima");
    expect(report.previsaoFimMes).toBeGreaterThan(report.mediaHistorica);
  });

  it("sugere aporte mensal quando existe uma meta ativa com prazo", () => {
    const goal = makeGoal({ name: "Viagem", current_amount: 0, target_amount: 1200, deadline: "2026-12-15" });
    const report = computeMonthReport({ transactions: [], cards: [], goals: [goal], now: NOW });

    expect(report.recomendacoes.some((tip) => tip.includes("Viagem"))).toBe(true);
  });

  it("compara com o mesmo mês do ano anterior quando há dado disponível", () => {
    const transactions = [
      makeTx({ date: "2025-06-10", type: "saida", amount: 1000, description: "Ano passado" }),
      makeTx({ date: "2026-06-10", type: "saida", amount: 1500, description: "Este ano" }),
    ];
    const report = computeMonthReport({ transactions, cards: [], goals: [], now: NOW });

    expect(report.comparacaoAnoAnterior).not.toBeNull();
    expect(report.comparacaoAnoAnterior?.gastoAnoPassado).toBe(1000);
    expect(report.comparacaoAnoAnterior?.diffPct).toBeGreaterThan(0);
  });
});
