import { format, startOfMonth, subMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import FluxoClient from "@/components/fluxo/FluxoClient";
import { getBankConnectionsWithAssets } from "@/lib/finance/bank-connections";
import type { Account, Card, Debt, RecurringItem, Transaction } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export default async function FluxoPage() {
  const supabase = await createClient();
  const from = format(startOfMonth(subMonths(new Date(), 17)), "yyyy-MM-dd");

  const [txRes, accRes, cardRes, connections, recRes, debtRes] = await Promise.all([
    supabase.from("transactions").select("*").gte("date", from).order("date", { ascending: false }),
    supabase.from("accounts").select("*").order("created_at"),
    supabase.from("cards").select("*").order("created_at"),
    getBankConnectionsWithAssets(supabase),
    supabase.from("recurring_items").select("*").eq("active", true),
    supabase.from("debts").select("*").eq("paid", false),
  ]);

  return (
    <FluxoClient
      transactions={(txRes.data ?? []) as Transaction[]}
      accounts={(accRes.data ?? []) as Account[]}
      cards={(cardRes.data ?? []) as Card[]}
      connections={connections}
      recurring={(recRes.data ?? []) as RecurringItem[]}
      debts={(debtRes.data ?? []) as Debt[]}
    />
  );
}
