import { describe, expect, it } from "vitest";
import { dailyLimitStatus } from "../daily-limit";
import { realtimeMovementMessage } from "@/lib/push/realtime-message";
import type { Transaction } from "../types";

function tx(date: string, amount: number, type: "entrada" | "saida" = "saida", category = "Alimentação"): Transaction {
  return { id: `${date}-${amount}`, date, amount, type, category, description: "x" } as Transaction;
}

describe("limite de hoje", () => {
  it("com orçamento: o que sobrou até ontem dividido pelos dias que faltam", () => {
    // Novembro tem 30 dias; dia 21 → faltam 10 dias (21 a 30).
    const status = dailyLimitStatus({
      tx: [tx("2026-11-03", 1000), tx("2026-11-21", 80), tx("2026-11-21", 50, "entrada")],
      totalBalance: 0,
      spendingLimit: 2000,
      todayKey: "2026-11-21",
    });
    expect(status.basis).toBe("budget");
    expect(status.perDay).toBeCloseTo(100);
    expect(status.spentToday).toBe(80);
    expect(status.remaining).toBeCloseTo(20);
    expect(status.over).toBe(0);
  });

  it("sem orçamento: saldo até o próximo dia 5, e mostra quanto passou", () => {
    // 26/11 → 05/12 = 10 dias, inclusive.
    const status = dailyLimitStatus({ tx: [tx("2026-11-26", 150)], totalBalance: 1000, spendingLimit: null, todayKey: "2026-11-26" });
    expect(status.basis).toBe("balance");
    expect(status.perDay).toBeCloseTo(100);
    expect(status.over).toBeCloseTo(50);
    expect(status.remaining).toBe(0);
  });
});

describe("aviso da movimentação em tempo real", () => {
  const gasto = { description: "SUPERMERCADO", amount: 100, type: "saida" as const, category: "Alimentação", bank: "Caixa" };

  it("gasto: saldo novo e quanto ainda pode gastar hoje", () => {
    const message = realtimeMovementMessage(gasto, {
      balance: 1234.56,
      daily: { perDay: 150, spentToday: 100, remaining: 50, over: 0, basis: "balance" },
      categoryLimit: null,
    });
    expect(message.title).toMatch(/^💸 Saiu R\$\s100,00 · Caixa$/);
    expect(message.body.split("\n")).toEqual([
      "SUPERMERCADO · Alimentação",
      expect.stringMatching(/^Saldo agora: R\$\s1\.234,56$/),
      expect.stringMatching(/^✅ Ainda pode gastar R\$\s50,00 hoje$/),
    ]);
  });

  it("gasto que passou do limite do dia e já está perto do limite da categoria", () => {
    const message = realtimeMovementMessage(gasto, {
      balance: 300,
      daily: { perDay: 60, spentToday: 100, remaining: 0, over: 40, basis: "budget" },
      categoryLimit: { spent: 450, limit: 500 },
    });
    expect(message.body).toMatch(/⚠️ Passou R\$\s40,00 do limite de hoje \(R\$\s60,00\)/);
    expect(message.body).toMatch(/⚠️ Alimentação: R\$\s450,00 de R\$\s500,00 \(90%\)/);
  });

  it("categoria longe do limite não aparece; estourada aparece com 🚨", () => {
    const longe = realtimeMovementMessage(gasto, { balance: null, daily: null, categoryLimit: { spent: 100, limit: 500 } });
    expect(longe.body).toBe("SUPERMERCADO · Alimentação");
    const estourada = realtimeMovementMessage(gasto, { balance: null, daily: null, categoryLimit: { spent: 520, limit: 500 } });
    expect(estourada.body).toMatch(/🚨 Alimentação: .*\(104%\)/);
  });

  it("entrada: título de entrada, sem linha de limite", () => {
    const message = realtimeMovementMessage(
      { description: "Pix recebido de ANA", amount: 0.01, type: "entrada", category: "Salário", bank: null },
      { balance: 10, daily: null, categoryLimit: null },
    );
    expect(message.title).toMatch(/^💰 Entrou R\$\s0,01$/);
    expect(message.body.split("\n")).toEqual(["Pix recebido de ANA", expect.stringMatching(/^Saldo agora: R\$\s10,00$/)]);
  });
});
