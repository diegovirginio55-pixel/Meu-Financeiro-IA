import { describe, expect, it } from "vitest";
import { buildMonthRecap, placeName, recapReminder } from "../month-recap";
import { makeTx } from "./fixtures";

describe("retrospectiva do mês", () => {
  it("agrupa compras pela marca ou pelas primeiras palavras", () => {
    expect(placeName("IFOOD *RESTAURANTE 123")).toBe("iFood");
    expect(placeName("PADARIA CENTRAL LTDA 0042")).toBe("Padaria central");
  });

  it("calcula gastos, comparação, favorito, dia mais caro e quanto sobrou", () => {
    const recap = buildMonthRecap({
      monthKey: "2026-10",
      daysCounted: 31,
      monthTx: [
        makeTx({ id: "1", description: "IFOOD *A", amount: 40, type: "saida", category: "Alimentação", date: "2026-10-03" }),
        makeTx({ id: "2", description: "IFOOD *B", amount: 60, type: "saida", category: "Alimentação", date: "2026-10-10" }),
        makeTx({ id: "3", description: "ASSAI ATACADISTA", amount: 486, type: "saida", category: "Alimentação", date: "2026-10-12" }),
        makeTx({ id: "4", description: "UBER *TRIP", amount: 30, type: "saida", category: "Transporte", date: "2026-10-12" }),
        makeTx({ id: "5", description: "SALARIO", amount: 1000, type: "entrada", category: "Salário", date: "2026-10-05" }),
      ],
      prevMonthTx: [makeTx({ id: "p", description: "X", amount: 1232, type: "saida", category: "Outros", date: "2026-09-10" })],
    });
    expect(recap.spent).toBe(616);
    expect(recap.change).toBeCloseTo(-0.5, 5);
    expect(recap.favorite).toMatchObject({ name: "iFood", count: 2, total: 100 });
    expect(recap.priciestDay).toMatchObject({ date: "2026-10-12", total: 516, mainDescription: "ASSAI ATACADISTA" });
    expect(recap.topCategory?.name).toBe("Alimentação");
    expect(recap.saved).toBe(384);
  });

  it("avisa nos 3 primeiros dias do mês, sobre o mês anterior", () => {
    expect(recapReminder(new Date("2026-11-02T15:00:00Z"))).toMatchObject({ refKey: "2026-10", url: "/retrospectiva?mes=2026-10" });
    expect(recapReminder(new Date("2026-11-10T15:00:00Z"))).toBeNull();
  });
});
