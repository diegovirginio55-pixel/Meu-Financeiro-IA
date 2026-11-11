import { describe, expect, it } from "vitest";
import { categoryColor } from "../categories";
import {
  balanceGrowthPercent,
  coinCount,
  groupBalanceByMonth,
  groupByCategory,
  monthOptions,
  parseMonthParam,
  parseVista,
  pickCoinUnit,
  shortMonthLabel,
  summarizeMonthSpending,
} from "../visao3d";
import { makeTx } from "./fixtures";

describe("groupByCategory", () => {
  it("soma por categoria, da maior para a menor, com cor e participação", () => {
    const slices = groupByCategory([
      { category: "Lazer", amount: 50 },
      { category: "Moradia", amount: 1000 },
      { category: "Lazer", amount: "150" },
    ]);
    expect(slices.map((slice) => [slice.name, slice.value, slice.count])).toEqual([
      ["Moradia", 1000, 1],
      ["Lazer", 200, 2],
    ]);
    expect(slices[0].color).toBe(categoryColor("Moradia"));
    expect(slices[0].share).toBeCloseTo(1000 / 1200);
  });

  it("mantém as 6 maiores e junta o resto (e a própria \"Outros\") em \"Outros\", por último", () => {
    const items = [
      { category: "A", amount: 900 },
      { category: "B", amount: 800 },
      { category: "C", amount: 700 },
      { category: "D", amount: 600 },
      { category: "E", amount: 500 },
      { category: "F", amount: 400 },
      { category: "G", amount: 300 },
      { category: "H", amount: 200 },
      { category: "Outros", amount: 1000 },
      { category: "", amount: 5 },
    ];
    const slices = groupByCategory(items);
    expect(slices.map((slice) => slice.name)).toEqual(["A", "B", "C", "D", "E", "F", "Outros"]);
    const outros = slices[slices.length - 1];
    expect(outros.value).toBe(300 + 200 + 1000 + 5);
    expect(outros.count).toBe(4);
    expect(slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1);
  });

  it("não cria \"Outros\" quando cabe tudo no top", () => {
    const slices = groupByCategory([
      { category: "A", amount: 10 },
      { category: "B", amount: 20 },
    ]);
    expect(slices.map((slice) => slice.name)).toEqual(["B", "A"]);
  });

  it("ignora valores zerados, negativos ou inválidos", () => {
    expect(
      groupByCategory([
        { category: "A", amount: 0 },
        { category: "B", amount: -50 },
        { category: "C", amount: "x" },
      ]),
    ).toEqual([]);
  });
});

describe("summarizeMonthSpending", () => {
  const txs = [
    makeTx({ id: "1", date: "2026-11-02", amount: 300, type: "saida", category: "Moradia", description: "Aluguel" }),
    makeTx({ id: "2", date: "2026-11-05", amount: 40, type: "saida", category: "Lazer", description: "Cinema" }),
    makeTx({ id: "3", date: "2026-11-06", amount: 500, type: "saida", category: "Transferências", description: "Pix para minha conta" }),
    makeTx({ id: "4", date: "2026-11-05", amount: 5000, type: "entrada", category: "Salário", description: "Salário" }),
    makeTx({ id: "5", date: "2026-10-30", amount: 999, type: "saida", category: "Moradia", description: "Mês passado" }),
    makeTx({ id: "6", date: "2026-11-08", amount: 60, type: "saida", category: "Lazer", description: "Bar" }),
  ];

  it("conta só os gastos e as entradas do mês (sem transferências)", () => {
    const summary = summarizeMonthSpending(txs, "2026-11");
    expect(summary.totalGastos).toBe(400);
    expect(summary.gastosCount).toBe(3);
    expect(summary.totalEntradas).toBe(5000);
    expect(summary.categories.map((slice) => [slice.name, slice.value])).toEqual([
      ["Moradia", 300],
      ["Lazer", 100],
    ]);
  });

  it("limita as estrelas às maiores compras e liga cada uma à sua fatia", () => {
    const summary = summarizeMonthSpending(txs, "2026-11", { top: 1, maxPoints: 2 });
    expect(summary.categories.map((slice) => slice.name)).toEqual(["Moradia", "Outros"]);
    expect(summary.pointsOmitted).toBe(1);
    expect(summary.points.map((point) => [point.id, point.category])).toEqual([
      ["1", "Moradia"],
      ["6", "Outros"],
    ]);
  });
});

describe("moedas", () => {
  it("usa R$ 100 enquanto a maior pilha tiver até 40 moedas", () => {
    expect(pickCoinUnit(0)).toBe(100);
    expect(pickCoinUnit(1500)).toBe(100);
    expect(pickCoinUnit(4049)).toBe(100);
  });

  it("passa para R$ 200, R$ 500 e R$ 1.000 conforme a maior categoria cresce", () => {
    expect(pickCoinUnit(4051)).toBe(200);
    expect(pickCoinUnit(8000)).toBe(200);
    expect(pickCoinUnit(9000)).toBe(500);
    expect(pickCoinUnit(20000)).toBe(500);
    expect(pickCoinUnit(30000)).toBe(1000);
    expect(pickCoinUnit(250000)).toBe(1000);
  });

  it("arredonda a quantidade de moedas", () => {
    expect(coinCount(1520, 100)).toBe(15);
    expect(coinCount(1550, 100)).toBe(16);
    expect(coinCount(40, 100)).toBe(0);
    expect(coinCount(-10, 100)).toBe(0);
  });
});

describe("groupBalanceByMonth", () => {
  const history = [
    { date: "2026-09-29", balance: 100 },
    { date: "2026-09-30", balance: 300 },
    { date: "2026-10-01", balance: 1000 },
    { date: "2026-10-02", balance: 400 },
    { date: "2026-10-03", balance: 700 },
  ];

  it("agrupa por mês com média, maior e menor dia", () => {
    const months = groupBalanceByMonth(history);
    expect(months.map((month) => month.monthKey)).toEqual(["2026-09", "2026-10"]);
    expect(months[1]).toMatchObject({
      label: "out/26",
      avg: 700,
      max: { day: 1, balance: 1000 },
      min: { day: 2, balance: 400 },
    });
    expect(balanceGrowthPercent(months)).toBe(250);
  });

  it("fica só com os últimos meses pedidos", () => {
    expect(groupBalanceByMonth(history, 1).map((month) => month.monthKey)).toEqual(["2026-10"]);
  });

  it("sem dois meses (ou com média inicial zero) não calcula a variação", () => {
    expect(balanceGrowthPercent(groupBalanceByMonth(history, 1))).toBeNull();
    expect(balanceGrowthPercent(groupBalanceByMonth([{ date: "2026-01-01", balance: 0 }, { date: "2026-02-01", balance: 5 }]))).toBeNull();
  });
});

describe("mês e aba da URL", () => {
  it("aceita o mês atual e até 11 anteriores", () => {
    expect(parseMonthParam("2026-11", "2026-11")).toBe("2026-11");
    expect(parseMonthParam("2025-12", "2026-11")).toBe("2025-12");
    expect(parseMonthParam("2025-11", "2026-11")).toBe("2026-11");
    expect(parseMonthParam("2026-12", "2026-11")).toBe("2026-11");
    expect(parseMonthParam("2026-13", "2026-11")).toBe("2026-11");
    expect(parseMonthParam(["2026-10"], "2026-11")).toBe("2026-11");
    expect(parseMonthParam(undefined, "2026-11")).toBe("2026-11");
  });

  it("lista 12 meses, do mais novo para o mais antigo", () => {
    const options = monthOptions("2026-11");
    expect(options).toHaveLength(12);
    expect(options[0]).toEqual({ key: "2026-11", label: "Novembro de 2026" });
    expect(options[11]).toEqual({ key: "2025-12", label: "Dezembro de 2025" });
    expect(shortMonthLabel("2025-12")).toBe("dez/25");
  });

  it("aba desconhecida cai na cidade", () => {
    expect(parseVista("galaxia")).toBe("galaxia");
    expect(parseVista("xyz")).toBe("cidade");
    expect(parseVista(undefined)).toBe("cidade");
  });
});
