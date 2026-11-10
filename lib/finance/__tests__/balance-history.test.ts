import { describe, expect, it } from "vitest";
import { dailyBalanceHistory, dayKeysBetween } from "../balance-history";

describe("dayKeysBetween", () => {
  it("lista os dias inclusive, cruzando o mês", () => {
    expect(dayKeysBetween("2026-01-30", "2026-02-02")).toEqual(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  });

  it("devolve vazio quando o início é depois do fim", () => {
    expect(dayKeysBetween("2026-02-02", "2026-02-01")).toEqual([]);
  });

  it("respeita o teto de dias", () => {
    expect(dayKeysBetween("2026-01-01", "2026-12-31", 10)).toHaveLength(10);
  });

  it("cobre um ano inteiro (a rota de 90 dias não pode cortar o fim)", () => {
    const keys = dayKeysBetween("2025-11-01", "2026-11-10");
    expect(keys[0]).toBe("2025-11-01");
    expect(keys[keys.length - 1]).toBe("2026-11-10");
  });
});

describe("dailyBalanceHistory", () => {
  it("repete o último saldo conhecido de cada conta nos dias sem foto", () => {
    const history = dailyBalanceHistory(
      [
        { account_id: "a", snapshot_date: "2026-03-01", balance: 100 },
        { account_id: "b", snapshot_date: "2026-03-01", balance: "50.5" },
        { account_id: "a", snapshot_date: "2026-03-03", balance: 300 },
      ],
      "2026-03-01",
      "2026-03-04",
    );
    expect(history).toEqual([
      { date: "2026-03-01", balance: 150.5 },
      { date: "2026-03-02", balance: 150.5 },
      { date: "2026-03-03", balance: 350.5 },
      { date: "2026-03-04", balance: 350.5 },
    ]);
  });

  it("usa fotos de antes do período só como ponto de partida", () => {
    const history = dailyBalanceHistory(
      [
        { account_id: "a", snapshot_date: "2026-02-20", balance: 10 },
        { account_id: "a", snapshot_date: "2026-02-25", balance: 80 },
        { account_id: "b", snapshot_date: "2026-03-02", balance: 20 },
      ],
      "2026-03-01",
      "2026-03-02",
    );
    expect(history).toEqual([
      { date: "2026-03-01", balance: 80 },
      { date: "2026-03-02", balance: 100 },
    ]);
  });

  it("pula os dias antes da primeira foto e ignora a ordem de entrada", () => {
    const history = dailyBalanceHistory(
      [
        { account_id: "a", snapshot_date: "2026-03-04", balance: 40 },
        { account_id: "a", snapshot_date: "2026-03-03", balance: 30 },
      ],
      "2026-03-01",
      "2026-03-04",
    );
    expect(history).toEqual([
      { date: "2026-03-03", balance: 30 },
      { date: "2026-03-04", balance: 40 },
    ]);
  });

  it("ignora fotos depois do fim e trata saldo inválido como zero", () => {
    const history = dailyBalanceHistory(
      [
        { account_id: "a", snapshot_date: "2026-03-01", balance: "abc" },
        { account_id: "a", snapshot_date: "2026-03-09", balance: 999 },
      ],
      "2026-03-01",
      "2026-03-02",
    );
    expect(history).toEqual([
      { date: "2026-03-01", balance: 0 },
      { date: "2026-03-02", balance: 0 },
    ]);
  });

  it("sem fotos, não devolve nada", () => {
    expect(dailyBalanceHistory([], "2026-03-01", "2026-03-31")).toEqual([]);
  });
});
