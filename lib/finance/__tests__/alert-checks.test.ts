import { describe, expect, it } from "vitest";
import { computeSmartAlertsFromData } from "../alert-checks";
import { dailyBudgetFromBalance, saoPauloTodayKey } from "../fluxo";
import { makeAccount, makeTx } from "./fixtures";

const NOW = new Date("2026-01-20T12:00:00-03:00");
const TODAY = saoPauloTodayKey(NOW);

function pastMonthsGastos(monthKeys: string[], amountPerMonth: number) {
  return monthKeys.flatMap((month) =>
    makeTx({ date: `${month}-10`, amount: amountPerMonth, type: "saida", category: "Outros" }),
  );
}

describe("computeSmartAlertsFromData — limite diário e ritmo do mês", () => {
  it("avisa quanto ainda pode gastar hoje quando o saldo é positivo", () => {
    const accounts = [makeAccount({ balance: 3100 })];
    const expected = dailyBudgetFromBalance(3100, TODAY);

    const alerts = computeSmartAlertsFromData({
      accounts,
      cards: [],
      recurring: [],
      debts: [],
      tx: [],
      now: NOW,
    });

    const dailyBudget = alerts.find((a) => a.kind === "daily_budget");
    expect(dailyBudget).toBeDefined();
    expect(dailyBudget?.refKey).toBe(TODAY);
    expect(dailyBudget?.body).toContain(
      expected.perDay.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    );
  });

  it("avisa que passou do limite quando o gasto de hoje é bem maior que o limite diário", () => {
    const accounts = [makeAccount({ balance: 150 })];
    // saldo baixo => limite diário baixo; um gasto de hoje bem maior que isso
    // deve disparar o alerta de "passou do limite".
    const tx = [makeTx({ date: TODAY, amount: 200, type: "saida", category: "Lazer" })];

    const alerts = computeSmartAlertsFromData({
      accounts,
      cards: [],
      recurring: [],
      debts: [],
      tx,
      now: NOW,
    });

    const overspend = alerts.find((a) => a.kind === "overspend_today");
    expect(overspend).toBeDefined();
    expect(overspend?.refKey).toBe(TODAY);
  });

  it("não avisa de saldo baixo quando o gasto de hoje está dentro do limite", () => {
    const accounts = [makeAccount({ balance: 10_000 })];
    const tx = [makeTx({ date: TODAY, amount: 10, type: "saida", category: "Lazer" })];

    const alerts = computeSmartAlertsFromData({
      accounts,
      cards: [],
      recurring: [],
      debts: [],
      tx,
      now: NOW,
    });

    expect(alerts.find((a) => a.kind === "overspend_today")).toBeUndefined();
  });

  it("avisa quando o ritmo de gastos do mês está bem acima da média histórica", () => {
    const pastMonths = ["2025-09", "2025-10", "2025-11", "2025-12"];
    const tx = [
      ...pastMonthsGastos(pastMonths, 1000),
      makeTx({ date: `${TODAY.slice(0, 7)}-05`, amount: 500, type: "saida", category: "Compras" }),
      makeTx({ date: `${TODAY.slice(0, 7)}-15`, amount: 400, type: "saida", category: "Compras" }),
    ];

    const alerts = computeSmartAlertsFromData({
      accounts: [makeAccount({ balance: 0 })],
      cards: [],
      recurring: [],
      debts: [],
      tx,
      now: NOW,
    });

    const pace = alerts.find((a) => a.kind === "month_pace_high");
    expect(pace).toBeDefined();
    expect(pace?.refKey).toBe(TODAY.slice(0, 7));
  });

  it("parabeniza quando o ritmo de gastos do mês está bem abaixo da média histórica", () => {
    const pastMonths = ["2025-09", "2025-10", "2025-11", "2025-12"];
    const tx = [
      ...pastMonthsGastos(pastMonths, 2000),
      makeTx({ date: `${TODAY.slice(0, 7)}-05`, amount: 100, type: "saida", category: "Compras" }),
    ];

    const alerts = computeSmartAlertsFromData({
      accounts: [makeAccount({ balance: 0 })],
      cards: [],
      recurring: [],
      debts: [],
      tx,
      now: NOW,
    });

    const pace = alerts.find((a) => a.kind === "month_pace_good");
    expect(pace).toBeDefined();
  });
});

describe("computeSmartAlertsFromData — orçamento definido pelo usuário", () => {
  it("usa o orçamento definido (não a média histórica) para o ritmo do mês", () => {
    // Sem orçamento, a média histórica (baixa) não geraria alerta. Com um
    // orçamento baixo definido pelo usuário, o gasto do mês já projeta
    // acima dele e deve disparar o alerta baseado no orçamento.
    const tx = [
      makeTx({ date: `${TODAY.slice(0, 7)}-05`, amount: 400, type: "saida", category: "Compras" }),
      makeTx({ date: `${TODAY.slice(0, 7)}-15`, amount: 400, type: "saida", category: "Compras" }),
    ];

    const alerts = computeSmartAlertsFromData({
      accounts: [makeAccount({ balance: 5000 })],
      cards: [],
      recurring: [],
      debts: [],
      tx,
      budget: { monthKey: TODAY.slice(0, 7), spendingLimit: 500, savingsTarget: null },
      now: NOW,
    });

    const pace = alerts.find((a) => a.kind === "month_pace_high");
    expect(pace).toBeDefined();
    expect(pace?.body).toContain("orçamento");
  });

  it("avisa quando a meta de economia do mês está em risco", () => {
    const tx = [
      makeTx({ date: `${TODAY.slice(0, 7)}-05`, amount: 1000, type: "entrada", category: "Salário" }),
      makeTx({ date: `${TODAY.slice(0, 7)}-06`, amount: 950, type: "saida", category: "Compras" }),
    ];

    const alerts = computeSmartAlertsFromData({
      accounts: [makeAccount({ balance: 1000 })],
      cards: [],
      recurring: [],
      debts: [],
      tx,
      budget: { monthKey: TODAY.slice(0, 7), spendingLimit: null, savingsTarget: 2000 },
      now: NOW,
    });

    expect(alerts.find((a) => a.kind === "savings_target_at_risk")).toBeDefined();
  });

  it("comemora quando a meta de economia do mês foi batida", () => {
    const tx = [
      makeTx({ date: `${TODAY.slice(0, 7)}-05`, amount: 3000, type: "entrada", category: "Salário" }),
      makeTx({ date: `${TODAY.slice(0, 7)}-06`, amount: 500, type: "saida", category: "Compras" }),
    ];

    const alerts = computeSmartAlertsFromData({
      accounts: [makeAccount({ balance: 1000 })],
      cards: [],
      recurring: [],
      debts: [],
      tx,
      budget: { monthKey: TODAY.slice(0, 7), spendingLimit: null, savingsTarget: 1000 },
      now: NOW,
    });

    expect(alerts.find((a) => a.kind === "savings_target_reached")).toBeDefined();
  });
});
