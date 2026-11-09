import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { investmentProductKey, promoteInvestmentsFromTransactions } from "../investment-movements";
import type { Account, Investment, Transaction } from "../types";
import { makeAccount, makeTx } from "./fixtures";

type Call = { table: string; op: string; payload?: unknown; filters: unknown[][] };

/** Supabase falso: devolve os lançamentos dados e registra gravações/exclusões. */
function fakeSupabase(transactions: Transaction[]) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      calls.push(call);
      const builder: Record<string, unknown> = new Proxy(
        {},
        {
          get(_target, prop: string) {
            if (prop === "then") {
              let result: { data: unknown; error: null };
              if (table === "transactions" && call.op === "select") {
                const range = call.filters.find((f) => f[0] === "range");
                result = { data: range && range[1] === 0 ? transactions : [], error: null };
              } else if (table === "investments" && call.op === "upsert") {
                result = { data: { id: `inv-${calls.length}`, ...(call.payload as object) }, error: null };
              } else {
                result = { data: null, error: null };
              }
              return (resolve: (value: unknown) => void) => resolve(result);
            }
            return (...args: unknown[]) => {
              if (["delete", "upsert", "update", "insert"].includes(prop)) {
                call.op = prop;
                call.payload = args[0];
              } else {
                call.filters.push([prop, ...args]);
              }
              return builder;
            };
          },
        },
      );
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

function investment(overrides: Partial<Investment>): Investment {
  return {
    id: "inv",
    user_id: "user-1",
    name: "Investimento",
    amount: 0,
    type: "LCI",
    pluggy_investment_id: null,
    bank_connection_id: "conn-inter",
    source: "pluggy",
    updated_at: "",
    ...overrides,
  } as Investment;
}

const inter: Account = makeAccount({ id: "acc-inter", name: "BANCO INTER • 4253", bank_connection_id: "conn-inter", source: "pluggy" });

describe("investimentos deduzidos do extrato", () => {
  it("LCD do Inter aplicada e resgatada com outro nome some do patrimônio (caso real)", async () => {
    const tx = [
      makeTx({ id: "t1", date: "2026-07-24", type: "entrada", amount: 67.52, description: "Vencimento Renda Fixa - Lci Di 30 Meses Banco Inter S A", account_id: "acc-inter", category: "Investimentos" }),
      makeTx({ id: "t2", date: "2026-08-13", type: "saida", amount: 12000, description: "Aplicação - Lci Liq6m 5anos Banco Inter S A", account_id: "acc-inter", category: "Investimentos" }),
      makeTx({ id: "t3", date: "2026-08-18", type: "saida", amount: 5111.07, description: "Débito Renda Fixa - Lcd Bdmg Liquid", account_id: "acc-inter", category: "Investimentos" }),
      makeTx({ id: "t4", date: "2026-09-09", type: "entrada", amount: 3078.78, description: "Crédito Renda Fixa - Lcd Di Flut Tb Banco De Desenvolvimento De Minas G", account_id: "acc-inter", category: "Investimentos" }),
      makeTx({ id: "t5", date: "2026-09-23", type: "entrada", amount: 2064.87, description: "Crédito Renda Fixa - Lcd Di Flut Tb Banco De Desenvolvimento De Minas G", account_id: "acc-inter", category: "Investimentos" }),
    ];
    const lci = investment({ id: "real-lci", name: "Inter · LCI - BANCO INTER S.A", amount: 12317.33, pluggy_investment_id: "pluggy-lci" });
    const ghostLcd = investment({ id: "ghost-lcd", name: "Inter · Lcd Bdmg Liquid", amount: 5111.07, type: "LCD", pluggy_investment_id: "bank-tx:lcd-bdmg-liquid" });
    const { client, calls } = fakeSupabase(tx);

    const result = await promoteInvestmentsFromTransactions(client, [inter], [lci, ghostLcd], "user-1");

    expect(result.map((row) => row.id)).toEqual(["real-lci"]);
    expect(result.reduce((sum, row) => sum + Number(row.amount), 0)).toBeCloseTo(12317.33, 2);
    const deletes = calls.filter((call) => call.table === "investments" && call.op === "delete");
    expect(deletes.some((call) => JSON.stringify(call.filters).includes("ghost-lcd"))).toBe(true);
    // Nenhum investimento novo inventado a partir do extrato.
    expect(calls.some((call) => call.table === "investments" && call.op === "upsert")).toBe(false);
  });

  it("resgate parcial desconta do valor aplicado", async () => {
    const tx = [
      makeTx({ id: "a", date: "2026-08-01", type: "saida", amount: 1000, description: "Aplicação CDB Banco X", account_id: "acc-inter", category: "Investimentos" }),
      makeTx({ id: "b", date: "2026-09-01", type: "entrada", amount: 400, description: "Resgate CDB Banco X", account_id: "acc-inter", category: "Investimentos" }),
    ];
    const { client, calls } = fakeSupabase(tx);
    await promoteInvestmentsFromTransactions(client, [inter], [], "user-1");
    const upsert = calls.find((call) => call.table === "investments" && call.op === "upsert");
    expect((upsert?.payload as { amount: number }).amount).toBeCloseTo(600, 2);
  });

  it("reconhece o produto mesmo com textos diferentes", () => {
    expect(investmentProductKey("Débito Renda Fixa - Lcd Bdmg Liquid")).toBe("lcd");
    expect(investmentProductKey("Crédito Renda Fixa - Lcd Di Flut Tb Banco De Desenvolvimento De Minas G")).toBe("lcd");
    expect(investmentProductKey("Aplicação - Lci Liq6m 5anos Banco Inter S A")).toBe("lci");
  });
});
