import { describe, expect, it } from "vitest";
import { categoryBudgetAlerts, categoryUsage, sanitizeCategoryLimits } from "../category-budgets";
import { futureInstallments, installmentsByMonth } from "../card-installments";
import { computeWeeklySummaryFromData } from "../alert-checks";
import { makeTx } from "./fixtures";

describe("limite por categoria", () => {
  it("ignora limites inválidos", () => {
    expect(sanitizeCategoryLimits({ Alimentação: 800, Lazer: -5, "": 10, Transporte: "300" })).toEqual({
      Alimentação: 800,
      Transporte: 300,
    });
  });

  it("soma só os gastos de verdade e avisa em 80% e ao estourar (uma vez por mês cada)", () => {
    const usage = categoryUsage({ Alimentação: 500, Transporte: 200, Lazer: 300 }, [
      makeTx({ id: "1", category: "Alimentação", amount: 420, type: "saida" }),
      makeTx({ id: "2", category: "Transporte", amount: 250, type: "saida" }),
      makeTx({ id: "3", category: "Alimentação", amount: 100, type: "entrada" }),
      makeTx({ id: "4", category: "Lazer", amount: 50, type: "saida" }),
    ]);
    expect(usage.map((item) => item.category)).toEqual(["Transporte", "Alimentação", "Lazer"]);
    const alerts = categoryBudgetAlerts(usage, "2026-11");
    expect(alerts.map((alert) => alert.refKey)).toEqual(["2026-11:Transporte:100", "2026-11:Alimentação:80"]);
    expect(alerts[0].title).toContain("estourado");
  });
});

describe("parcelas do cartão", () => {
  const purchase = (number: number, billForecastDate: string) => ({
    description: "LOJA X",
    amount: -100,
    date: "2026-10-05",
    creditCardMetadata: { installmentNumber: number, totalInstallments: 4, billForecastDate },
  });

  it("projeta as parcelas que ainda vão cair depois da fatura atual", () => {
    const items = futureInstallments([purchase(2, "2026-11")], "2026-11");
    expect(items.map((item) => `${item.number}/${item.total} ${item.monthKey}`)).toEqual(["3/4 2026-12", "4/4 2027-01"]);
    const months = installmentsByMonth(items, "2026-11", 3);
    expect(months.map((month) => month.total)).toEqual([100, 100, 0]);
  });

  it("não duplica parcela futura que a Pluggy já mandou e ignora compra à vista", () => {
    const items = futureInstallments(
      [purchase(2, "2026-11"), purchase(3, "2026-12"), { description: "MERCADO", amount: -50, date: "2026-11-02", creditCardMetadata: { totalInstallments: 1, installmentNumber: 1 } }],
      "2026-11",
    );
    expect(items.map((item) => item.number)).toEqual([3, 4]);
  });
});

describe("resumo da semana", () => {
  it("compara com a semana anterior e mostra a categoria que mais pesou", () => {
    const monday = new Date("2026-11-09T15:00:00Z");
    const summary = computeWeeklySummaryFromData({
      now: monday,
      tx: [
        makeTx({ id: "a", date: "2026-11-03", amount: 300, type: "saida", category: "Alimentação" }),
        makeTx({ id: "b", date: "2026-11-05", amount: 100, type: "saida", category: "Transporte" }),
        makeTx({ id: "c", date: "2026-10-28", amount: 200, type: "saida", category: "Alimentação" }),
      ],
    });
    expect(summary?.body).toContain("100% a mais");
    expect(summary?.body).toContain("mais em Alimentação");
  });
});
