import { describe, expect, it } from "vitest";
import { computeHealthScore, healthScoreLabel } from "../health-score";
import { makeCard, makeGoal, makeTx } from "./fixtures";

const NOW = new Date("2026-06-15T12:00:00Z");

describe("computeHealthScore", () => {
  it("dá nota alta pra quem tem reserva, sem dívidas e economiza todo mês", () => {
    const transactions = [
      // Meses anteriores estáveis: entra 5000, gasta 3000 (economiza 2000/mês).
      ...["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"].flatMap((month) => [
        makeTx({ date: `${month}-05`, type: "entrada", category: "Salário", amount: 5000 }),
        makeTx({ date: `${month}-10`, type: "saida", amount: 3000, description: "Contas" }),
      ]),
      makeTx({ date: "2026-06-05", type: "entrada", category: "Salário", amount: 5000 }),
      makeTx({ date: "2026-06-10", type: "saida", amount: 3000, description: "Contas" }),
    ];
    const goal = makeGoal({ current_amount: 900, target_amount: 1000 });

    const result = computeHealthScore({
      transactions,
      cards: [],
      debts: [],
      goals: [goal],
      totalBalance: 20000,
      totalInvestments: 5000,
      now: NOW,
    });

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(healthScoreLabel(result.score)).not.toBe("Precisa de atenção");
  });

  it("dá nota baixa pra quem não tem reserva, tem dívidas e gasta tudo", () => {
    const transactions = [
      makeTx({ date: "2026-06-05", type: "entrada", category: "Salário", amount: 2000 }),
      makeTx({ date: "2026-06-06", type: "saida", amount: 2100, description: "Contas" }),
    ];
    const card = makeCard({ credit_limit: 1000, current_invoice: 950 });

    const result = computeHealthScore({
      transactions,
      cards: [card],
      debts: [
        { id: "d1", user_id: "user-1", description: "Empréstimo", amount: 8000, person: null, due_date: null, paid: false, created_at: "2026-01-01T00:00:00.000Z" },
      ],
      goals: [],
      totalBalance: 50,
      totalInvestments: 0,
      now: NOW,
    });

    expect(result.score).toBeLessThan(50);
  });

  it("sempre sugere no máximo 2 melhorias", () => {
    const result = computeHealthScore({
      transactions: [],
      cards: [],
      debts: [],
      goals: [],
      totalBalance: 0,
      totalInvestments: 0,
      now: NOW,
    });
    expect(result.howToImprove.length).toBeLessThanOrEqual(2);
  });
});
