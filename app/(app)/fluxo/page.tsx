import { createClient } from "@/lib/supabase/server";
import FluxoClient from "@/components/fluxo/FluxoClient";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";
import { lastNMonthKeys } from "@/lib/finance/fluxo";
import type { Account, Card, Debt, RecurringItem, Transaction } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export default async function FluxoPage() {
  const supabase = await createClient();
  const from = `${lastNMonthKeys(18)[0]}-01`;

  const [txRes, accRes, cardRes, connections, recRes, debtRes] = await Promise.all([
    supabase.from("transactions").select("*").gte("date", from).order("date", { ascending: false }),
    supabase.from("accounts").select("*").order("created_at"),
    supabase.from("cards").select("*").order("created_at"),
    getBankConnectionsWithAssets(supabase),
    supabase.from("recurring_items").select("*").eq("active", true),
    supabase.from("debts").select("*").eq("paid", false),
  ]);

  const bankNameById = new Map(connections.map((c) => [c.id, c.institution_name]));
  const accounts = ((accRes.data ?? []) as Account[]).map((a) => ({
    ...a,
    institution_name: a.bank_connection_id ? bankNameById.get(a.bank_connection_id) ?? null : null,
  }));
  const cards = ((cardRes.data ?? []) as Card[]).map((c) => ({
    ...c,
    institution_name: c.bank_connection_id ? bankNameById.get(c.bank_connection_id) ?? null : null,
  }));

  return (
    <FluxoClient
      transactions={(txRes.data ?? []) as Transaction[]}
      accounts={accounts}
      cards={cards}
      connections={connections}
      recurring={(recRes.data ?? []) as RecurringItem[]}
      debts={(debtRes.data ?? []) as Debt[]}
    />
  );
}
