import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signPushAction, verifyPushAction } from "@/lib/push/actions";
import { movementPayloads } from "@/lib/push/payload";
import { billKey, computeBillReminders } from "../bill-reminders";
import type { Debt, RecurringItem } from "../types";
import { makeCard } from "./fixtures";

describe("token dos botões da notificação", () => {
  beforeEach(() => {
    vi.stubEnv("PUSH_ACTION_SECRET", "segredo-de-teste");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("assina e valida o lançamento certo", () => {
    const token = signPushAction({ k: "tx", u: "user-1", t: "tx-9" });
    expect(verifyPushAction(token)).toEqual({ k: "tx", u: "user-1", t: "tx-9" });
  });

  it("recusa token adulterado (ex.: trocar o lançamento)", () => {
    const token = signPushAction({ k: "tx", u: "user-1", t: "tx-9" })!;
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ k: "tx", u: "user-1", t: "tx-OUTRO", e: Date.now() + 1e9 })).toString("base64url");
    expect(verifyPushAction(`${forged}.${sig}`)).toBeNull();
    expect(verifyPushAction("lixo")).toBeNull();
  });

  it("recusa token vencido", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    const token = signPushAction({ k: "bill", u: "u", b: "debt", r: "d1", d: "2026-11-02" }, 1);
    vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
    expect(verifyPushAction(token)).toBeNull();
  });
});

describe("texto do push de gasto", () => {
  it("gasto com id mostra a categoria e abre a tela de categorizar", () => {
    const [payload] = movementPayloads("Nubank", [
      { id: "tx-1", description: "IFOOD", amount: 45, type: "saida", date: "2026-11-09", category: "Alimentação" },
    ]);
    expect(payload.body).toContain("Categoria: Alimentação");
    expect(payload.url).toBe("/categorizar/tx-1");
  });

  it("entrada continua abrindo o extrato", () => {
    const [payload] = movementPayloads("Nubank", [{ id: "tx-2", description: "Pix", amount: 100, type: "entrada" }]);
    expect(payload.url).toBe("/detalhes");
  });
});

function recurring(overrides: Partial<RecurringItem>): RecurringItem {
  return {
    id: "rec-1",
    user_id: "user-1",
    description: "Aluguel",
    amount: 1500,
    type: "saida",
    category: "Moradia",
    day_of_month: 10,
    active: true,
    created_at: "",
    ...overrides,
  };
}

function debt(overrides: Partial<Debt>): Debt {
  return {
    id: "debt-1",
    user_id: "user-1",
    description: "Empréstimo",
    amount: 300,
    person: "João",
    due_date: "2026-11-10",
    paid: false,
    created_at: "",
    ...overrides,
  };
}

describe("lembretes de contas a pagar", () => {
  const DAY_BEFORE = new Date("2026-11-09T09:00:00-03:00");
  const DUE_DAY = new Date("2026-11-10T09:00:00-03:00");

  it("lembra na véspera e no dia (refKeys diferentes)", () => {
    const base = { debts: [], cards: [], paidKeys: new Set<string>() };
    const vespera = computeBillReminders({ ...base, recurring: [recurring({})], now: DAY_BEFORE });
    const hoje = computeBillReminders({ ...base, recurring: [recurring({})], now: DUE_DAY });
    expect(vespera[0]?.title).toBe("Conta vence amanhã 📅");
    expect(hoje[0]?.title).toBe("Conta vence hoje 📅");
    expect(vespera[0]?.refKey).not.toBe(hoje[0]?.refKey);
    expect(hoje[0]?.bill).toEqual({ kind: "recurring", id: "rec-1", dueDate: "2026-11-10" });
  });

  it("não lembra conta marcada como paga, dívida paga nem recorrência de entrada", () => {
    const paid = new Set([billKey({ kind: "recurring", id: "rec-1", dueDate: "2026-11-10" })]);
    const reminders = computeBillReminders({
      recurring: [recurring({}), recurring({ id: "rec-2", type: "entrada", description: "Salário" })],
      debts: [debt({ paid: true })],
      cards: [],
      paidKeys: paid,
      now: DUE_DAY,
    });
    expect(reminders).toHaveLength(0);
  });

  it("dívida e fatura: dívida na véspera; fatura só no dia do vencimento", () => {
    const cards = [makeCard({ id: "card-1", due_day: 10, current_invoice: 900, name: "Nubank" })];
    const vespera = computeBillReminders({ recurring: [], debts: [debt({})], cards, paidKeys: new Set(), now: DAY_BEFORE });
    expect(vespera.map((r) => r.bill.kind)).toEqual(["debt"]);
    const hoje = computeBillReminders({ recurring: [], debts: [], cards, paidKeys: new Set(), now: DUE_DAY });
    expect(hoje.map((r) => r.bill.kind)).toEqual(["card"]);
    expect(hoje[0].body).toContain("Fatura Nubank");
  });
});
