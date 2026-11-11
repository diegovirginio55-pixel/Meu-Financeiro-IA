import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isGasto,
  isRenda,
  nextPaydayKey,
  nthBusinessDayKey,
  nextMonthlyOccurrenceKey,
  toSaoPauloDateOnly,
} from "../fluxo";
import { isCardBillPayment } from "../categories";
import { isValidDateKey, parsePositiveMoney, parseTransactionUpdate } from "../validation";
import { csvCell } from "../export-csv";
import { applyTransactionChange } from "../apply-transaction-effect";
import { computeSmartAlertsFromData } from "../alert-checks";
import { weightedHoldingDays } from "../investment-yield";
import { formatCurrency } from "../format";
import { makeAccount, makeCard, makeTx } from "./fixtures";

describe("classificação: fatura de cartão não conta em dobro", () => {
  it("pagamento de fatura na conta não é gasto (as compras do cartão já são)", () => {
    const pagamento = makeTx({ type: "saida", description: "PAGAMENTO FATURA CARTAO NUBANK", category: "Dívidas" });
    expect(isCardBillPayment(pagamento)).toBe(true);
    expect(isGasto(pagamento)).toBe(false);
  });

  it("compra no cartão continua sendo gasto", () => {
    expect(isGasto(makeTx({ type: "saida", description: "IFOOD", card_id: "card-x", category: "Alimentação" }))).toBe(true);
  });

  it("crédito lançado no próprio cartão (pagamento recebido) não é renda", () => {
    const credito = makeTx({ type: "entrada", description: "Pagamento recebido", card_id: "card-x", category: "Dívidas" });
    expect(isRenda(credito)).toBe(false);
  });

  it("empréstimo/financiamento continua sendo gasto", () => {
    expect(isGasto(makeTx({ type: "saida", description: "PARCELA FINANCIAMENTO", category: "Dívidas" }))).toBe(true);
  });

  it("Pix para outra pessoa e Pix por QR Code contam como gasto; só \"Transferências\" fica de fora", () => {
    expect(isGasto(makeTx({ type: "saida", description: "Pix enviado - Izoleide Mangueira Da Cruz", category: "Outros" }))).toBe(true);
    expect(isGasto(makeTx({ type: "saida", description: "DEB PIX QR COD EST", category: "Outros" }))).toBe(true);
    expect(isGasto(makeTx({ type: "saida", description: "PIX ENVIADO JOAO", category: "Moradia" }))).toBe(true);
    expect(isGasto(makeTx({ type: "saida", description: "Pix enviado - Diego Silva", category: "Transferências" }))).toBe(false);
    expect(isRenda(makeTx({ type: "entrada", description: "PIX RECEBIDO MARIA", category: "Outros" }))).toBe(true);
    expect(isRenda(makeTx({ type: "entrada", description: "Transferência Recebida|DIEGO", category: "Transferências" }))).toBe(false);
  });
});

describe("datas da Pluggy", () => {
  it("meia-noite UTC exata é 'só a data' (não recua um dia)", () => {
    expect(toSaoPauloDateOnly("2026-12-01T00:00:00.000Z")).toBe("2026-12-01");
    expect(toSaoPauloDateOnly("2026-12-01T00:00:00Z")).toBe("2026-12-01");
  });

  it("horário real continua convertido para Brasília", () => {
    expect(toSaoPauloDateOnly("2026-12-01T02:30:00.000Z")).toBe("2026-11-30");
    expect(toSaoPauloDateOnly("2026-12-01T15:00:00.000Z")).toBe("2026-12-01");
  });
});

describe("vencimentos mensais respeitam o tamanho do mês", () => {
  it("dia 31 vira o último dia de meses curtos (não mais 28 fixo)", () => {
    expect(nextMonthlyOccurrenceKey(31, "2026-04-10")).toBe("2026-04-30");
    expect(nextMonthlyOccurrenceKey(31, "2026-02-10")).toBe("2026-02-28");
    expect(nextMonthlyOccurrenceKey(30, "2026-01-29")).toBe("2026-01-30");
  });

  it("vencimento que já passou vai para o mês seguinte, inclusive na virada do ano", () => {
    expect(nextMonthlyOccurrenceKey(10, "2026-12-15")).toBe("2027-01-10");
    expect(nextMonthlyOccurrenceKey(31, "2027-01-31")).toBe("2027-01-31");
  });

  it("salário no 5º dia útil, pulando fim de semana e feriado (Finados, Independência, Ano-Novo)", () => {
    expect(nthBusinessDayKey(2026, 11, 5)).toBe("2026-11-09");
    expect(nthBusinessDayKey(2026, 10, 5)).toBe("2026-10-07");
    expect(nthBusinessDayKey(2026, 9, 5)).toBe("2026-09-08");
    expect(nthBusinessDayKey(2027, 1, 5)).toBe("2027-01-08");
  });

  it("próximo dia de salário é deste mês só antes do 5º dia útil", () => {
    expect(nextPaydayKey("2026-11-03")).toBe("2026-11-09");
    expect(nextPaydayKey("2026-11-09")).toBe("2026-12-07");
    expect(nextPaydayKey("2026-12-20")).toBe("2027-01-08");
  });

  it("Carnaval e Sexta-feira Santa não são dia útil", () => {
    // 2027: Carnaval 8 e 9/fev, Sexta-feira Santa 26/mar.
    expect(nthBusinessDayKey(2027, 2, 6)).toBe("2027-02-10");
    expect(nthBusinessDayKey(2027, 3, 20)).toBe("2027-03-29");
  });
});

describe("validação de entrada", () => {
  it("rejeita datas que não existem", () => {
    expect(isValidDateKey("2026-11-31")).toBe(false);
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2028-02-29")).toBe(true);
  });

  it("valor precisa ser positivo e finito", () => {
    expect(parsePositiveMoney(-10)).toBeNull();
    expect(parsePositiveMoney("abc")).toBeNull();
    expect(parsePositiveMoney(12.345)).toBe(12.35);
  });

  it("PATCH de lançamento recusa valor vazio (antes virava R$ 0)", () => {
    expect(parseTransactionUpdate({ amount: "" }).ok).toBe(false);
    expect(parseTransactionUpdate({ type: "x" }).ok).toBe(false);
    expect(parseTransactionUpdate({ category: "Lazer" })).toEqual({ ok: true, updates: { category: "Lazer" } });
  });
});

describe("CSV", () => {
  it("neutraliza fórmulas vindas de descrições de terceiros", () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+5511999")).toBe("'+5511999");
    expect(csvCell("Mercado")).toBe("Mercado");
    expect(csvCell("-12,50", { numeric: true })).toBe("-12,50");
  });
});

function fakeSupabase(rows: Record<string, { source: string; balance?: number; current_invoice?: number }>) {
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  const client = {
    from: () => ({
      select: () => ({
        eq: (_column: string, id: string) => ({
          maybeSingle: async () => ({ data: rows[id] ?? null, error: null }),
        }),
      }),
    }),
    rpc,
  };
  return { client: client as unknown as SupabaseClient, rpc };
}

describe("reajuste de saldo ao editar/excluir lançamento", () => {
  it("editar só a categoria não mexe em saldo nem fatura", async () => {
    const { client, rpc } = fakeSupabase({ "card-1": { source: "manual", current_invoice: 50 } });
    const effect = { account_id: null, card_id: "card-1", type: "saida" as const, amount: 200 };
    await applyTransactionChange(client, effect, effect);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mudar o valor aplica só a diferença", async () => {
    const { client, rpc } = fakeSupabase({ "acc-1": { source: "manual", balance: 1000 } });
    await applyTransactionChange(
      client,
      { account_id: "acc-1", card_id: null, type: "saida", amount: 100 },
      { account_id: "acc-1", card_id: null, type: "saida", amount: 150 },
    );
    expect(rpc).toHaveBeenCalledWith("adjust_account_balance", { p_account_id: "acc-1", p_delta: -50 });
  });

  it("excluir devolve o valor ao saldo", async () => {
    const { client, rpc } = fakeSupabase({ "acc-1": { source: "manual", balance: 1000 } });
    await applyTransactionChange(client, { account_id: "acc-1", card_id: null, type: "saida", amount: 80 }, null);
    expect(rpc).toHaveBeenCalledWith("adjust_account_balance", { p_account_id: "acc-1", p_delta: 80 });
  });

  it("conta sincronizada com o banco não é alterada (o saldo vem do banco)", async () => {
    const { client, rpc } = fakeSupabase({ "acc-1": { source: "pluggy", balance: 1000 } });
    await applyTransactionChange(client, { account_id: "acc-1", card_id: null, type: "saida", amount: 80 }, null);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("alertas", () => {
  const NOW = new Date("2026-01-01T12:00:00-03:00");

  it("limite do dia não desconta o gasto de hoje duas vezes", () => {
    const alerts = computeSmartAlertsFromData({
      accounts: [makeAccount({ balance: 5000 })],
      cards: [],
      recurring: [],
      debts: [],
      tx: [makeTx({ date: "2026-01-01", amount: 300, type: "saida", description: "Mercado", category: "Alimentação" })],
      budget: { monthKey: "2026-01", spendingLimit: 3100, savingsTarget: null },
      now: NOW,
    });
    const daily = alerts.find((a) => a.kind === "daily_budget");
    // 3100 / 31 dias = 100 por dia (o gasto de hoje não reduz o limite de hoje).
    expect(daily?.body).toContain(`Limite do dia: ${formatCurrency(100)}`);
  });

  it("dívida já paga não gera alerta de saldo negativo; fatura a vencer gera", () => {
    const base = {
      accounts: [makeAccount({ balance: 500 })],
      recurring: [],
      tx: [],
      now: new Date("2026-01-20T12:00:00-03:00"),
    };
    const paid = computeSmartAlertsFromData({
      ...base,
      cards: [],
      debts: [
        { id: "d1", user_id: "user-1", description: "Empréstimo", amount: 800, person: null, due_date: "2026-01-22", paid: true, created_at: "" },
      ],
    });
    expect(paid.some((a) => a.kind === "low_balance")).toBe(false);

    const withInvoice = computeSmartAlertsFromData({
      ...base,
      cards: [makeCard({ due_day: 25, current_invoice: 900 })],
      debts: [],
    });
    expect(withInvoice.some((a) => a.kind === "low_balance")).toBe(true);
  });
});

describe("rendimento estimado de investimentos", () => {
  it("usa o prazo médio ponderado pelo valor de cada aplicação", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T12:00:00-03:00"));
    const days = weightedHoldingDays([], [
      { id: "a", investment_id: "i", bank_connection_id: null, type: "BUY", amount: 1000, date: "2026-01-13" },
      { id: "b", investment_id: "i", bank_connection_id: null, type: "BUY", amount: 99000, date: "2026-11-08" },
    ]);
    vi.useRealTimers();
    // (1000 × 300 + 99000 × 1) / 100000 ≈ 4 dias — não 300.
    expect(days).toBeGreaterThan(3);
    expect(days).toBeLessThan(5);
  });
});
