import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyProvisionalToBalances, reconcileProvisional } from "../provisional";
import { makeAccount, makeCard } from "@/lib/finance/__tests__/fixtures";

const connection = {
  id: "conn-1",
  status_detail: JSON.stringify({ dataUpdatedAt: "2026-11-09T12:00:00.000Z" }),
  last_synced_at: "2026-11-09T18:00:00.000Z",
};

function provisional(overrides: Record<string, unknown>) {
  return {
    id: "p1",
    amount: 50,
    type: "saida" as const,
    account_id: null,
    card_id: null,
    date: "2026-11-09",
    category: "Outros",
    created_at: "2026-11-09T15:00:00.000Z",
    pluggy_transaction_id: "notif:abc",
    ...overrides,
  };
}

describe("saldo estimado com as notificações do celular", () => {
  it("desconta da conta só o que chegou depois da última atualização do banco", () => {
    const account = makeAccount({ id: "acc-1", balance: 1000, bank_connection_id: "conn-1", source: "pluggy" });
    const { accounts } = applyProvisionalToBalances(
      [account],
      [],
      [
        provisional({ id: "depois", account_id: "acc-1", amount: 50, created_at: "2026-11-09T15:00:00.000Z" }),
        // Antes da atualização do banco: já está no saldo informado pelo banco.
        provisional({ id: "antes", account_id: "acc-1", amount: 30, created_at: "2026-11-09T10:00:00.000Z" }),
        provisional({ id: "pix", account_id: "acc-1", amount: 20, type: "entrada", created_at: "2026-11-09T16:00:00.000Z" }),
      ],
      [connection],
    );
    expect(accounts[0].balance).toBe(970);
    expect(accounts[0].provisional_delta).toBe(-30);
  });

  it("compra no cartão aumenta a fatura estimada", () => {
    const card = makeCard({ id: "card-1", current_invoice: 200, bank_connection_id: "conn-1", source: "pluggy" });
    const { cards } = applyProvisionalToBalances([], [card], [provisional({ card_id: "card-1", amount: 45.9 })], [connection]);
    expect(cards[0].current_invoice).toBe(245.9);
  });
});

describe("troca do provisório pelo lançamento oficial", () => {
  it("apaga o provisório, mantém a categoria escolhida e não notifica de novo", async () => {
    const calls: { table: string; op: string; payload?: unknown; filters: unknown[][] }[] = [];
    const rows = [provisional({ id: "prov-1", account_id: "acc-1", amount: 45.9, category: "Alimentação" })];
    const client = {
      from(table: string) {
        const call = { table, op: "select", payload: undefined as unknown, filters: [] as unknown[][] };
        calls.push(call);
        const builder: Record<string, unknown> = new Proxy(
          {},
          {
            get(_target, prop: string) {
              if (prop === "then") {
                const data = call.op === "select" ? rows : null;
                return (resolve: (value: unknown) => void) => resolve({ data, error: null });
              }
              return (...args: unknown[]) => {
                if (["delete", "update"].includes(prop)) {
                  call.op = prop;
                  call.payload = args[0];
                } else call.filters.push([prop, ...args]);
                return builder;
              };
            },
          },
        );
        return builder;
      },
    } as unknown as SupabaseClient;

    const matched = await reconcileProvisional(client, "user-1", { accountId: "acc-1", cardId: null }, [
      { id: "oficial-1", amount: 45.9, type: "saida", date: "2026-11-10", category: "Outros" },
      { id: "oficial-2", amount: 12, type: "saida", date: "2026-11-10", category: "Outros" },
    ]);

    expect([...matched]).toEqual(["oficial-1"]);
    expect(calls.some((c) => c.op === "update" && (c.payload as { category: string }).category === "Alimentação")).toBe(true);
    expect(calls.some((c) => c.op === "delete" && JSON.stringify(c.filters).includes("prov-1"))).toBe(true);
  });
});
