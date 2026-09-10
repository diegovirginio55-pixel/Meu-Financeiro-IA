import { describe, expect, it } from "vitest";
import {
  daysAgoKey,
  isGasto,
  isRenda,
  lastNMonthKeys,
  saoPauloMonthEndKey,
  saoPauloMonthKey,
  saoPauloMonthStartKey,
  shiftMonthKey,
  sumGastosInRange,
} from "../fluxo";
import { makeTx } from "./fixtures";

describe("isGasto / isRenda", () => {
  it("considera saída normal como gasto", () => {
    expect(isGasto(makeTx({ type: "saida", description: "Supermercado" }))).toBe(true);
  });

  it("não considera Pix/transferência como gasto", () => {
    expect(isGasto(makeTx({ type: "saida", description: "Pix para Maria" }))).toBe(false);
  });

  it("não considera aplicação em investimento como gasto", () => {
    expect(isGasto(makeTx({ type: "saida", description: "Aplicação CDB", category: "Investimentos" }))).toBe(false);
  });

  it("considera entrada normal como renda", () => {
    expect(isRenda(makeTx({ type: "entrada", description: "Salário", category: "Salário" }))).toBe(true);
  });

  it("não considera entrada como renda se for saída", () => {
    expect(isRenda(makeTx({ type: "saida" }))).toBe(false);
  });
});

describe("chaves de mês/data", () => {
  it("shiftMonthKey soma e subtrai meses corretamente, cruzando o ano", () => {
    expect(shiftMonthKey("2026-01", 1)).toBe("2026-02");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2025-12", 1)).toBe("2026-01");
  });

  it("lastNMonthKeys retorna N meses terminando no mês informado", () => {
    const keys = lastNMonthKeys(3, "2026-03");
    expect(keys).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("saoPauloMonthKey/Start/End derivam do mesmo mês", () => {
    const date = new Date("2026-06-15T12:00:00Z");
    const monthKey = saoPauloMonthKey(date);
    expect(saoPauloMonthStartKey(date)).toBe(`${monthKey}-01`);
    expect(saoPauloMonthEndKey(date).startsWith(monthKey)).toBe(true);
  });

  it("daysAgoKey calcula uma data no passado", () => {
    const today = new Date("2026-06-15T12:00:00Z");
    expect(daysAgoKey(10, today)).toBe("2026-06-05");
  });
});

describe("sumGastosInRange", () => {
  it("soma apenas gastos dentro do intervalo informado", () => {
    const tx = [
      makeTx({ date: "2026-01-10", amount: 50, type: "saida" }),
      makeTx({ date: "2026-01-15", amount: 30, type: "saida" }),
      makeTx({ date: "2026-01-20", amount: 999, type: "saida" }), // fora do intervalo
      makeTx({ date: "2026-01-12", amount: 1000, type: "entrada" }), // não é gasto
    ];
    expect(sumGastosInRange(tx, "2026-01-01", "2026-01-16")).toBe(80);
  });
});
