import { describe, expect, it } from "vitest";
import { billPaymentKey, buildMonthBills, dueDateInMonth } from "../month-bills";
import { makeCard, makeTx } from "./fixtures";
import type { Debt, RecurringItem } from "../types";

function recurring(overrides: Partial<RecurringItem>): RecurringItem {
  return {
    id: "r1",
    user_id: "u1",
    description: "Conta de luz",
    amount: 150,
    type: "saida",
    category: "Moradia",
    day_of_month: 10,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function debt(overrides: Partial<Debt>): Debt {
  return {
    id: "d1",
    user_id: "u1",
    description: "IPVA",
    amount: 800,
    person: null,
    due_date: "2026-11-20",
    paid: false,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const base = { monthKey: "2026-11", todayKey: "2026-11-08", debts: [] as Debt[], cards: [], paidKeys: new Set<string>() };

describe("contas do mês", () => {
  it("dia 31 em mês de 30 dias cai no último dia", () => {
    expect(dueDateInMonth("2026-11", 31)).toBe("2026-11-30");
    expect(dueDateInMonth("2026-02", 30)).toBe("2026-02-28");
  });

  it("soma a pagar e a receber, separa o que já foi pago e calcula a sobra com o saldo em conta", () => {
    const summary = buildMonthBills({
      ...base,
      recurring: [
        recurring({ id: "luz", amount: 150, day_of_month: 10 }),
        recurring({ id: "agua", description: "Conta de água", amount: 80, day_of_month: 5 }),
        recurring({ id: "sal", description: "Salário", amount: 3000, type: "entrada", category: "Salário", day_of_month: 5 }),
      ],
      cards: [makeCard({ id: "nu", name: "Nubank", current_invoice: 1200, due_day: 15, source: "pluggy" })],
      paidKeys: new Set([billPaymentKey("recurring", "agua", "2026-11-05"), billPaymentKey("recurring", "sal", "2026-11-05")]),
      accountBalance: 500,
    });
    expect(summary.totals.pagar).toBe(1430);
    expect(summary.totals.pago).toBe(80);
    expect(summary.totals.faltaPagar).toBe(1350);
    expect(summary.totals.receber).toBe(3000);
    expect(summary.totals.faltaReceber).toBe(0);
    // 500 em conta + 0 a receber − 1350 a pagar
    expect(summary.totals.sobra).toBe(-850);
    expect(summary.pagar.find((bill) => bill.id === "nu")).toMatchObject({ fromBank: true, status: "futuro" });
    expect(summary.pagar.find((bill) => bill.id === "luz")?.status).toBe("proximo");
    expect(summary.suggestions.some((tip) => tip.tone === "alerta" && tip.text.includes("Faltam"))).toBe(true);
  });

  it("conta de uma vez só atrasada de outro mês continua aparecendo no mês atual", () => {
    const summary = buildMonthBills({
      ...base,
      recurring: [],
      debts: [debt({ id: "velha", due_date: "2026-10-28" }), debt({ id: "paga", due_date: "2026-10-01", paid: true })],
    });
    expect(summary.pagar.map((bill) => bill.id)).toEqual(["velha"]);
    expect(summary.pagar[0].status).toBe("atrasado");
  });

  it("acha no extrato o salário que já caiu e a conta que já foi paga", () => {
    const summary = buildMonthBills({
      ...base,
      recurring: [
        recurring({ id: "sal", description: "Salário", amount: 3000, type: "entrada", day_of_month: 5 }),
        recurring({ id: "luz", amount: 150, day_of_month: 3 }),
      ],
      transactions: [
        makeTx({ id: "t1", description: "PAGAMENTO EMPRESA X", amount: 3000, type: "entrada", date: "2026-11-05" }),
        makeTx({ id: "t2", description: "ENEL CONTA", amount: 151.3, type: "saida", date: "2026-11-04" }),
        makeTx({ id: "t3", description: "PADARIA", amount: 3000, type: "saida", date: "2026-11-05" }),
      ],
    });
    expect(summary.receber[0].match?.id).toBe("t1");
    expect(summary.pagar[0].match?.id).toBe("t2");
  });

  it("sem nada cadastrado, sugere cadastrar as contas", () => {
    const summary = buildMonthBills({ ...base, recurring: [] });
    expect(summary.suggestions).toHaveLength(1);
    expect(summary.suggestions[0].text).toContain("Cadastre");
  });
});
